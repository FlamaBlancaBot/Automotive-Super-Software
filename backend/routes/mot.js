'use strict'

const express = require('express')
const { normaliseRegistration } = require('../db/utils')

function toInt(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toBool(value, fallback = false) {
  if (value == null) return fallback
  const v = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return fallback
}

function toDateTimeSql(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

function parseDateTime(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return null
  return d
}

async function getMotSettings(db) {
  const rows = await db.all(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'mot.%' ORDER BY setting_key ASC`,
  ).catch(() => [])
  const map = {}
  for (const row of rows || []) map[row.setting_key] = row.setting_value
  return {
    webhook_url: String(map['mot.webhook_url'] || 'https://automationplatform.business-automations.uk/webhook/MOTcheck').trim(),
    first_check_delay_minutes: toInt(map['mot.first_check_delay_minutes'], 45),
    retry_delay_1_minutes: toInt(map['mot.retry_delay_1_minutes'], 10),
    retry_delay_2_minutes: toInt(map['mot.retry_delay_2_minutes'], 10),
    retry_delay_3_minutes: toInt(map['mot.retry_delay_3_minutes'], 5),
    delayed_retry_minutes: toInt(map['mot.delayed_retry_minutes'], 20),
    max_checks_per_mot: toInt(map['mot.max_checks_per_mot'], 20),
    scheduler_enabled: toBool(map['mot.scheduler_enabled'], true),
    scheduler_interval_seconds: Math.max(15, toInt(map['mot.scheduler_interval_seconds'], 60)),
  }
}

function retryDelayMinutesForAttempt(attemptNumber, settings) {
  if (attemptNumber <= 1) return settings.retry_delay_1_minutes
  if (attemptNumber === 2) return settings.retry_delay_2_minutes
  if (attemptNumber === 3) return settings.retry_delay_3_minutes
  return settings.delayed_retry_minutes
}

async function createNotification(db, payload) {
  await db.run(
    `INSERT INTO platform_notifications (
      user_id, notification_type, title, message, severity, related_type, related_id, action_url, sound_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.user_id || null,
      payload.notification_type,
      payload.title,
      payload.message,
      payload.severity || 'info',
      payload.related_type || null,
      payload.related_id != null ? payload.related_id : null,
      payload.action_url || null,
      payload.sound_key || null,
    ],
  ).catch(() => {})
}

async function upsertMotResultCheckForJob(tx, jobId, vehicleId, registration, bookedStart) {
  const existing = await tx.get(`SELECT * FROM mot_result_checks WHERE job_id = ? ORDER BY id DESC LIMIT 1`, [jobId])
  if (existing) return existing

  const created = await tx.run(
    `INSERT INTO mot_result_checks (job_id, vehicle_id, registration, booked_start, status)
     VALUES (?, ?, ?, ?, 'booked')`,
    [jobId || null, vehicleId || null, registration, bookedStart || null],
  )
  return tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [created.lastInsertId])
}

async function markArrivedForCheck(tx, checkId, nowUtc, settings) {
  const row = await tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
  if (!row) {
    const err = new Error('MOT result check not found.')
    err.status = 404
    throw err
  }

  const now = nowUtc || new Date()
  const booked = parseDateTime(row.booked_start)
  const firstDue = booked
    ? new Date(booked.getTime() + Math.max(1, settings.first_check_delay_minutes) * 60 * 1000)
    : new Date(now.getTime() + 60 * 1000)
  const nextCheck = firstDue.getTime() <= now.getTime() ? new Date(now.getTime() + 30 * 1000) : firstDue

  await tx.run(
    `UPDATE mot_result_checks
     SET arrived_at = COALESCE(arrived_at, ?),
         status = CASE WHEN status IN ('complete', 'failed') THEN status ELSE 'awaiting_result' END,
         next_check_at = CASE WHEN status IN ('complete', 'failed') THEN next_check_at ELSE ? END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [toDateTimeSql(now), toDateTimeSql(nextCheck), checkId],
  )

  return tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
}

async function writeFaults(tx, checkId, faults = []) {
  await tx.run(`DELETE FROM mot_result_faults WHERE mot_result_check_id = ?`, [checkId])
  for (const f of faults) {
    await tx.run(
      `INSERT INTO mot_result_faults (mot_result_check_id, fault_group, text, dangerous, type_raw)
       VALUES (?, ?, ?, ?, ?)`,
      [checkId, f.fault_group, f.text, f.dangerous ? 1 : 0, f.type_raw || null],
    )
  }
}

function flattenFaults(groupName, rows) {
  return (rows || []).map((x) => ({
    fault_group: groupName,
    text: String((x && x.text) || ''),
    dangerous: Boolean(x && x.dangerous),
    type_raw: x && x.type_raw ? String(x.type_raw) : null,
  })).filter((x) => x.text)
}

async function runMotCheckNow(db, checkId, trigger = 'manual') {
  const settings = await getMotSettings(db)
  const now = new Date()

  const base = await db.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
  if (!base) {
    const err = new Error('MOT result check not found.')
    err.status = 404
    throw err
  }
  if (!base.arrived_at) {
    const err = new Error('Vehicle not marked arrived/offsite yet.')
    err.status = 409
    throw err
  }
  if (base.status === 'complete' || base.status === 'failed') {
    return { row: base, skipped: true, reason: 'already_complete' }
  }

  const payload = {
    registration: String(base.registration || '').trim(),
    job_id: base.job_id || null,
    booked_start: base.booked_start || null,
    mot_result_check_id: base.id,
  }

  let responseJson = null
  let fetchError = null
  try {
    const response = await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    try {
      responseJson = text ? JSON.parse(text) : null
    } catch {
      responseJson = null
    }
    if (!response.ok) {
      fetchError = `Webhook returned HTTP ${response.status}`
    }
  } catch (err) {
    fetchError = String(err && err.message ? err.message : err)
  }

  return db.transaction(async (tx) => {
    const row = await tx.get(`SELECT * FROM mot_result_checks WHERE id = ? FOR UPDATE`, [checkId])
    if (!row) {
      const err = new Error('MOT result check not found during update.')
      err.status = 404
      throw err
    }

    const nextAttempts = Number(row.check_attempts || 0) + 1

    if (fetchError || !responseJson || responseJson.ok !== true) {
      const errorText = fetchError || 'Webhook response malformed or not ok.'
      const nextDue = new Date(now.getTime() + retryDelayMinutesForAttempt(nextAttempts, settings) * 60 * 1000)
      await tx.run(
        `UPDATE mot_result_checks
         SET check_attempts = ?, last_checked_at = ?, last_error = ?, next_check_at = ?, status = CASE WHEN status = 'booked' THEN 'awaiting_result' ELSE status END, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextAttempts, toDateTimeSql(now), errorText.slice(0, 1000), toDateTimeSql(nextDue), checkId],
      )

      if (nextAttempts >= 3) {
        await createNotification(tx, {
          notification_type: 'mot_webhook_error',
          title: `MOT check webhook issue (${row.registration})`,
          message: `Repeated webhook errors while checking MOT result. Last error: ${errorText}`,
          severity: 'warning',
          related_type: 'mot_result_check',
          related_id: checkId,
          action_url: `/mot?check_id=${checkId}`,
          sound_key: null,
        })
      }

      const updated = await tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
      return { row: updated, error: errorText }
    }

    const motStatus = String(responseJson.mot_status || 'unknown').trim().toLowerCase()
    const motStatusLabel = String(responseJson.mot_status_label || motStatus || 'Unknown').trim()
    const latestTest = responseJson.latest_test || {}
    const summary = responseJson.summary || {}

    const failures = Array.isArray(responseJson.failures) ? responseJson.failures : []
    const minors = Array.isArray(responseJson.minors) ? responseJson.minors : []
    const advisories = Array.isArray(responseJson.advisories) ? responseJson.advisories : []

    const allFaults = [
      ...flattenFaults('failures', failures),
      ...flattenFaults('minors', minors),
      ...flattenFaults('advisories', advisories),
    ]

    const complete = motStatus === 'passed' || motStatus === 'failed'
    const isDelayed = !complete && nextAttempts > 3
    const nextDue = complete
      ? null
      : new Date(now.getTime() + retryDelayMinutesForAttempt(nextAttempts, settings) * 60 * 1000)

    const nextStatus = complete ? (motStatus === 'failed' ? 'failed' : 'complete') : (isDelayed ? 'delayed' : 'awaiting_result')

    await tx.run(
      `UPDATE mot_result_checks
       SET status = ?, mot_status = ?, mot_status_label = ?,
           latest_test_date = ?, latest_test_result = ?, latest_test_expiry = ?,
           failures_count = ?, minors_count = ?, advisories_count = ?,
           raw_response_json = ?, next_check_at = ?, check_attempts = ?,
           delayed_at = CASE WHEN ? = 1 AND delayed_at IS NULL THEN ? ELSE delayed_at END,
           last_checked_at = ?, last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nextStatus,
        motStatus || null,
        motStatusLabel || null,
        latestTest.date || null,
        latestTest.result || null,
        latestTest.expiry || null,
        toInt(summary.failures_count, failures.length),
        toInt(summary.minors_count, minors.length),
        toInt(summary.advisories_count, advisories.length),
        JSON.stringify(responseJson),
        nextDue ? toDateTimeSql(nextDue) : null,
        nextAttempts,
        isDelayed ? 1 : 0,
        toDateTimeSql(now),
        toDateTimeSql(now),
        checkId,
      ],
    )

    await writeFaults(tx, checkId, allFaults)

    if (complete) {
      await createNotification(tx, {
        notification_type: 'mot_result',
        title: motStatus === 'passed' ? `MOT passed: ${row.registration}` : `MOT failed: ${row.registration}`,
        message: `${motStatusLabel}. Failures: ${toInt(summary.failures_count, failures.length)}. Minors: ${toInt(summary.minors_count, minors.length)}. Advisories: ${toInt(summary.advisories_count, advisories.length)}.`,
        severity: motStatus === 'passed' ? 'success' : 'danger',
        related_type: 'mot_result_check',
        related_id: checkId,
        action_url: `/mot?check_id=${checkId}`,
        sound_key: motStatus === 'passed' ? 'success' : 'danger',
      })
    } else if (isDelayed && !row.delayed_at) {
      await createNotification(tx, {
        notification_type: 'mot_delayed',
        title: `MOT delayed: ${row.registration}`,
        message: `MOT result still not complete after initial retries. Continuing checks every ${settings.delayed_retry_minutes} minutes.`,
        severity: 'warning',
        related_type: 'mot_result_check',
        related_id: checkId,
        action_url: `/mot?check_id=${checkId}`,
        sound_key: 'warning',
      })
    }

    const updated = await tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
    return { row: updated, response: responseJson, trigger }
  })
}

let motScheduler = null
let motSchedulerRunning = false

function startMotScheduler({ db }) {
  if (motScheduler) return
  motScheduler = setInterval(async () => {
    if (motSchedulerRunning) return
    motSchedulerRunning = true
    try {
      const settings = await getMotSettings(db)
      if (!settings.scheduler_enabled) return

      const dueRows = await db.all(
        `SELECT * FROM mot_result_checks
         WHERE arrived_at IS NOT NULL
           AND next_check_at IS NOT NULL
           AND next_check_at <= UTC_TIMESTAMP()
           AND status NOT IN ('complete', 'failed')
           AND check_attempts < ?
         ORDER BY next_check_at ASC
         LIMIT 20`,
        [Math.max(1, settings.max_checks_per_mot)],
      ).catch(() => [])

      for (const row of dueRows || []) {
        try {
          await runMotCheckNow(db, row.id, 'scheduler')
        } catch {
          // keep scheduler resilient
        }
      }
    } finally {
      motSchedulerRunning = false
    }
  }, 60 * 1000)
}

function createMotRouter({ db }) {
  const router = express.Router()

  router.get('/mot/checks', async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const q = String(req.query.q || '').trim()

    const where = []
    const params = []
    if (status) {
      where.push('c.status = ?')
      params.push(status)
    }
    if (q) {
      const like = `%${q}%`
      where.push('(c.registration LIKE ? OR CAST(c.job_id AS CHAR) LIKE ?)')
      params.push(like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await db.all(
      `SELECT
         c.*,
         j.title AS job_title,
         j.status AS job_status,
         v.make AS vehicle_make,
         v.model AS vehicle_model
       FROM mot_result_checks c
       LEFT JOIN jobs j ON j.id = c.job_id
       LEFT JOIN vehicles v ON v.id = c.vehicle_id
       ${whereSql}
       ORDER BY COALESCE(c.next_check_at, c.updated_at) ASC, c.id DESC
       LIMIT 400`,
      params,
    ).catch(() => [])

    res.json({ ok: true, checks: rows || [] })
  })

  router.get('/mot/checks/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid MOT check id.' })

    const check = await db.get(
      `SELECT c.*, j.title AS job_title, j.status AS job_status, v.make AS vehicle_make, v.model AS vehicle_model
       FROM mot_result_checks c
       LEFT JOIN jobs j ON j.id = c.job_id
       LEFT JOIN vehicles v ON v.id = c.vehicle_id
       WHERE c.id = ?`,
      [id],
    )
    if (!check) return res.status(404).json({ ok: false, error: 'MOT check not found.' })

    const faults = await db.all(
      `SELECT * FROM mot_result_faults WHERE mot_result_check_id = ? ORDER BY FIELD(fault_group,'failures','minors','advisories'), id ASC`,
      [id],
    ).catch(() => [])

    res.json({ ok: true, check, faults: faults || [] })
  })

  router.post('/mot/checks', async (req, res) => {
    const body = req.body || {}
    const registration = normaliseRegistration(body.registration)
    if (!registration) return res.status(400).json({ ok: false, error: 'registration is required.' })

    const created = await db.run(
      `INSERT INTO mot_result_checks (job_id, vehicle_id, registration, booked_start, status)
       VALUES (?, ?, ?, ?, 'booked')`,
      [
        body.job_id ? toInt(body.job_id, null) : null,
        body.vehicle_id ? toInt(body.vehicle_id, null) : null,
        registration,
        body.booked_start ? String(body.booked_start).trim() : null,
      ],
    )

    const check = await db.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [created.lastInsertId])
    res.status(201).json({ ok: true, check })
  })

  router.post('/mot/checks/:id/mark-arrived', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid MOT check id.' })

    try {
      const settings = await getMotSettings(db)
      const check = await db.transaction((tx) => markArrivedForCheck(tx, id, new Date(), settings))
      res.json({ ok: true, check })
    } catch (err) {
      const status = Number(err && err.status) || 500
      res.status(status).json({ ok: false, error: String(err.message || 'Failed to mark arrived.') })
    }
  })

  router.post('/mot/checks/:id/run-now', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid MOT check id.' })
    try {
      const result = await runMotCheckNow(db, id, 'manual')
      res.json({ ok: true, ...result })
    } catch (err) {
      const status = Number(err && err.status) || 500
      res.status(status).json({ ok: false, error: String(err.message || 'Failed to run MOT check now.') })
    }
  })

  router.patch('/mot/checks/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid MOT check id.' })

    const body = req.body || {}
    const current = await db.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [id])
    if (!current) return res.status(404).json({ ok: false, error: 'MOT check not found.' })

    await db.run(
      `UPDATE mot_result_checks
       SET booked_start = ?, arrived_at = ?, status = ?, next_check_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.booked_start != null ? (body.booked_start || null) : current.booked_start,
        body.arrived_at != null ? (body.arrived_at || null) : current.arrived_at,
        body.status != null ? String(body.status).trim().toLowerCase() : current.status,
        body.next_check_at != null ? (body.next_check_at || null) : current.next_check_at,
        id,
      ],
    )

    const updated = await db.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [id])
    res.json({ ok: true, check: updated })
  })

  router.get('/mot/settings', async (_req, res) => {
    const settings = await getMotSettings(db)
    res.json({ ok: true, settings })
  })

  router.patch('/mot/settings', async (req, res) => {
    const body = req.body || {}
    const updates = [
      ['mot.webhook_url', String(body.webhook_url || '').trim(), 'string'],
      ['mot.first_check_delay_minutes', String(toInt(body.first_check_delay_minutes, 45)), 'number'],
      ['mot.retry_delay_1_minutes', String(toInt(body.retry_delay_1_minutes, 10)), 'number'],
      ['mot.retry_delay_2_minutes', String(toInt(body.retry_delay_2_minutes, 10)), 'number'],
      ['mot.retry_delay_3_minutes', String(toInt(body.retry_delay_3_minutes, 5)), 'number'],
      ['mot.delayed_retry_minutes', String(toInt(body.delayed_retry_minutes, 20)), 'number'],
      ['mot.max_checks_per_mot', String(toInt(body.max_checks_per_mot, 20)), 'number'],
      ['mot.scheduler_enabled', String(Boolean(body.scheduler_enabled)), 'boolean'],
    ]

    await db.transaction(async (tx) => {
      for (const [k, v, t] of updates) {
        if (!v) continue
        await tx.run(
          `INSERT INTO system_settings (setting_key, setting_value, setting_type)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type), updated_at = CURRENT_TIMESTAMP`,
          [k, v, t],
        )
      }
    })

    const settings = await getMotSettings(db)
    res.json({ ok: true, settings })
  })

  router.post('/jobs/:id/mot/mark-arrived', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })

    try {
      const settings = await getMotSettings(db)
      const out = await db.transaction(async (tx) => {
        const job = await tx.get(
          `SELECT j.id, j.vehicle_id, j.booked_start, v.registration
           FROM jobs j
           JOIN vehicles v ON v.id = j.vehicle_id
           WHERE j.id = ?`,
          [jobId],
        )
        if (!job) {
          const err = new Error('Job not found.')
          err.status = 404
          throw err
        }
        const reg = normaliseRegistration(job.registration)
        const check = await upsertMotResultCheckForJob(tx, job.id, job.vehicle_id, reg, job.booked_start)
        const updated = await markArrivedForCheck(tx, check.id, new Date(), settings)
        return { check: updated }
      })
      res.json({ ok: true, ...out })
    } catch (err) {
      const status = Number(err && err.status) || 500
      res.status(status).json({ ok: false, error: String(err.message || 'Failed to mark MOT arrived.') })
    }
  })

  return router
}

module.exports = {
  createMotRouter,
  startMotScheduler,
  runMotCheckNow,
  upsertMotResultCheckForJob,
}
