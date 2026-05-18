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

function toDateOnlySql(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toDateOnlySql(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

function pad4(n) {
  return String(n).padStart(4, '0')
}

function toDecimal(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function roundMoney(value) {
  return Math.round(toDecimal(value, 0) * 100) / 100
}

async function generateQuoteNumber(tx) {
  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`
  const last = await tx.get(
    `SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`],
  )
  let next = 1
  if (last && last.quote_number) {
    const m = String(last.quote_number).match(/Q-\d{4}-(\d{4})$/)
    if (m && m[1]) next = Number(m[1]) + 1
  }
  return `${prefix}${pad4(next)}`
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

async function runWithFallback(tx, primarySql, primaryParams, fallbackSql, fallbackParams) {
  try {
    return await tx.run(primarySql, primaryParams)
  } catch (err) {
    const code = String(err && err.code ? err.code : '')
    const msg = String(err && err.message ? err.message : '')
    if (code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(msg)) {
      return tx.run(fallbackSql, fallbackParams)
    }
    throw err
  }
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

async function createQuoteFromMotCheck(tx, { checkId, selectedFaults, quoteTitle, optionalJobId, createJobIfMissing }) {
  const check = await tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
  if (!check) {
    const err = new Error('MOT check not found.')
    err.status = 404
    throw err
  }

  const faultRows = await tx.all(
    `SELECT * FROM mot_result_faults WHERE mot_result_check_id = ? ORDER BY FIELD(fault_group,'failures','minors','advisories'), id ASC`,
    [checkId],
  )
  const byId = new Map((faultRows || []).map((f) => [Number(f.id), f]))

  const included = (selectedFaults || [])
    .filter((x) => x && x.include !== false)
    .map((x) => ({ ...x, fault_id: toInt(x.fault_id, 0) }))
    .filter((x) => x.fault_id && byId.has(x.fault_id))

  if (!included.length) {
    const err = new Error('No MOT faults were selected for quote creation.')
    err.status = 400
    throw err
  }

  let linkedJobId = toInt(optionalJobId, null) || toInt(check.job_id, null)
  let customerId = null
  let vehicleId = toInt(check.vehicle_id, null)
  let titleBase = String(quoteTitle || '').trim() || 'MOT Repair Quote'

  if (linkedJobId) {
    const job = await tx.get(
      `SELECT j.id, j.customer_id, j.vehicle_id, j.title, st.name AS service_template_name
       FROM jobs j
       LEFT JOIN service_templates st ON st.id = j.service_template_id
       WHERE j.id = ?`,
      [linkedJobId],
    )
    if (!job) {
      const err = new Error('Linked job not found for MOT quote creation.')
      err.status = 404
      throw err
    }
    customerId = job.customer_id
    vehicleId = job.vehicle_id
    titleBase = String(job.title || job.service_template_name || titleBase).trim() || titleBase
  } else if (createJobIfMissing) {
    const err = new Error('MOT check is not linked to a job/customer. Create or link a job before generating a customer quote.')
    err.status = 409
    throw err
  } else {
    const err = new Error('This MOT check is not linked to a job. Create or link a job before generating a customer quote.')
    err.status = 409
    throw err
  }

  if (!customerId || !vehicleId) {
    const err = new Error('Missing customer or vehicle context for quote creation.')
    err.status = 409
    throw err
  }

  const existing = await tx.get(
    `SELECT id, status, revision_number FROM quotes WHERE job_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
    [linkedJobId],
  )
  const existingStatus = String(existing && existing.status ? existing.status : '').toLowerCase()
  const sourceQuoteId = existing && existingStatus === 'accepted' ? existing.id : null
  const revisionNumber = sourceQuoteId ? Math.max(2, Number(existing.revision_number || 1) + 1) : 1
  const title = sourceQuoteId ? `${titleBase} - ADDITIONAL WORK` : titleBase

  const quoteNumber = await generateQuoteNumber(tx)
  const created = await tx.run(
    `INSERT INTO quotes (
      quote_number, customer_id, vehicle_id, job_id, status, title,
      parent_quote_id, supersedes_quote_id, revision_number, revision_reason,
      source_type, source_id,
      subtotal_cost, subtotal_sell, vat_rate, vat_amount, total_sell, estimated_margin
    ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, 0, 0, 0.2000, 0, 0, 0)`,
    [
      quoteNumber,
      customerId,
      vehicleId,
      linkedJobId,
      title,
      sourceQuoteId ? sourceQuoteId : null,
      sourceQuoteId,
      revisionNumber,
      sourceQuoteId ? 'Additional MOT work discovered after accepted quote' : 'MOT repair draft quote',
      'mot_result_check',
      checkId,
    ],
  )
  const quoteId = created.lastInsertId

  let sortOrder = 10
  for (const entry of included) {
    const fault = byId.get(Number(entry.fault_id))
    const lineTitle = String(entry.title || fault.text || '').trim() || 'MOT item'
    const detail = String(entry.description || '').trim()
    const fullDescription = detail
      ? `${lineTitle}\n${detail}`
      : `${lineTitle}\nPrice to be confirmed`
    const unitCost = Math.max(0, toDecimal(entry.parts_cost, 0))
    const unitSellRaw = entry.sell_price == null || entry.sell_price === '' ? null : toDecimal(entry.sell_price, 0)
    const unitSell = Math.max(0, unitSellRaw == null ? 0 : unitSellRaw)
    const qty = 1
    const totalCost = roundMoney(qty * unitCost)
    const totalSell = roundMoney(qty * unitSell)

    await tx.run(
      `INSERT INTO quote_items (
        quote_id, item_type, description, quantity,
        unit_cost, unit_sell, markup_percent, vat_rate, eta_text,
        total_cost, total_sell, selected_for_quote, sort_order
      ) VALUES (?, 'mot_repair', ?, ?, ?, ?, NULL, 0.2000, NULL, ?, ?, 1, ?)`,
      [quoteId, fullDescription, qty, unitCost, unitSell, totalCost, totalSell, sortOrder],
    )
    sortOrder += 10
  }

  const sums = await tx.get(
    `SELECT
       COALESCE(SUM(total_cost), 0) AS subtotal_cost,
       COALESCE(SUM(total_sell), 0) AS subtotal_sell,
       COALESCE(SUM(total_sell * COALESCE(vat_rate, 0.2)), 0) AS vat_amount
     FROM quote_items
     WHERE quote_id = ? AND selected_for_quote = 1`,
    [quoteId],
  )
  const subtotalCost = roundMoney(sums ? sums.subtotal_cost : 0)
  const subtotalSell = roundMoney(sums ? sums.subtotal_sell : 0)
  const vatAmount = roundMoney(sums ? sums.vat_amount : 0)
  const totalSell = roundMoney(subtotalSell + vatAmount)
  const margin = roundMoney(subtotalSell - subtotalCost)
  await tx.run(
    `UPDATE quotes
     SET subtotal_cost = ?, subtotal_sell = ?, vat_amount = ?, total_sell = ?, estimated_margin = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [subtotalCost, subtotalSell, vatAmount, totalSell, margin, quoteId],
  )

  await runWithFallback(
    tx,
    `UPDATE mot_result_checks
     SET created_quote_id = ?, created_quote_number = ?, quote_created_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [quoteId, quoteNumber, checkId],
    `UPDATE mot_result_checks SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [checkId],
  )

  const quote = await tx.get(`SELECT id, quote_number, status, title, job_id FROM quotes WHERE id = ?`, [quoteId])
  return { quote, linked_job_id: linkedJobId }
}

async function markArrivedForCheck(tx, checkId, nowUtc, settings) {
  const row = await tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
  if (!row) {
    const err = new Error('MOT result check not found.')
    err.status = 404
    throw err
  }

  const now = nowUtc || new Date()
  const perCheckInterval = Number(row.polling_interval_minutes || 0)
  let firstDue
  if (perCheckInterval > 0) {
    firstDue = new Date(now.getTime() + perCheckInterval * 60 * 1000)
  } else {
    const booked = parseDateTime(row.booked_start)
    firstDue = booked
      ? new Date(booked.getTime() + Math.max(1, settings.first_check_delay_minutes) * 60 * 1000)
      : new Date(now.getTime() + 60 * 1000)
  }
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
  const automaticTrigger = trigger === 'scheduler' || trigger === 'automatic'

  const base = await db.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
  if (!base) {
    const err = new Error('MOT result check not found.')
    err.status = 404
    throw err
  }
  if (automaticTrigger && !base.arrived_at) {
    const err = new Error('Vehicle not marked arrived/offsite yet.')
    err.status = 409
    throw err
  }
  const registration = String(base.registration || '').trim()
  if (!registration) {
    const err = new Error('Registration missing on MOT check.')
    err.status = 409
    throw err
  }
  if (!settings.webhook_url) {
    const err = new Error('MOT webhook URL is not configured.')
    err.status = 500
    throw err
  }
  if (base.status === 'complete' || base.status === 'failed') {
    return { row: base, skipped: true, reason: 'already_complete' }
  }

  const payload = {
    registration,
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
    const perCheckInterval = Number(row.polling_interval_minutes || 0)

    if (fetchError || !responseJson || responseJson.ok !== true) {
      const errorText = fetchError || 'Webhook response malformed or not ok.'
      if (automaticTrigger) {
        const retryMinutes = perCheckInterval > 0
          ? perCheckInterval
          : retryDelayMinutesForAttempt(nextAttempts, settings)
        const nextDue = new Date(now.getTime() + retryMinutes * 60 * 1000)
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
      } else {
        await runWithFallback(
          tx,
          `UPDATE mot_result_checks
           SET last_manual_checked_at = ?, last_error = ?, last_action_message = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [toDateTimeSql(now), errorText.slice(0, 1000), 'Manual MOT check failed.', checkId],
          `UPDATE mot_result_checks
           SET last_error = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [errorText.slice(0, 1000), checkId],
        )
      }

      const updated = await tx.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [checkId])
      return { row: updated, error: errorText }
    }

    const motStatus = String(responseJson.mot_status || 'unknown').trim().toLowerCase()
    const motStatusLabel = String(responseJson.mot_status_label || motStatus || 'Unknown').trim()
    const latestTest = responseJson && typeof responseJson.latest_test === 'object' && responseJson.latest_test
      ? responseJson.latest_test
      : {}
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
    const isDelayed = automaticTrigger && !complete && nextAttempts > 3
    const scheduledRetryMinutes = perCheckInterval > 0
      ? perCheckInterval
      : retryDelayMinutesForAttempt(nextAttempts, settings)
    const nextDue = complete
      ? null
      : new Date(now.getTime() + scheduledRetryMinutes * 60 * 1000)

    if (automaticTrigger || complete) {
      const nextStatus = complete ? (motStatus === 'failed' ? 'failed' : 'complete') : (isDelayed ? 'delayed' : 'awaiting_result')
      await runWithFallback(
        tx,
        `UPDATE mot_result_checks
         SET status = ?, mot_status = ?, mot_status_label = ?,
             latest_test_date = ?, latest_test_result = ?, latest_test_expiry = ?,
             failures_count = ?, minors_count = ?, advisories_count = ?,
             raw_response_json = ?, next_check_at = ?, check_attempts = ?,
             delayed_at = CASE WHEN ? = 1 AND delayed_at IS NULL THEN ? ELSE delayed_at END,
             last_checked_at = ?, last_manual_checked_at = CASE WHEN ? = 1 THEN last_manual_checked_at ELSE ? END,
             last_manual_status = CASE WHEN ? = 1 THEN last_manual_status ELSE ? END,
             last_manual_status_label = CASE WHEN ? = 1 THEN last_manual_status_label ELSE ? END,
             last_manual_response_json = CASE WHEN ? = 1 THEN last_manual_response_json ELSE ? END,
             last_action_message = ?, last_error = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          nextStatus,
          motStatus || null,
          motStatusLabel || null,
          toDateOnlySql(latestTest.date),
          latestTest.result || null,
          toDateOnlySql(latestTest.expiry),
          toInt(summary.failures_count, failures.length),
          toInt(summary.minors_count, minors.length),
          toInt(summary.advisories_count, advisories.length),
          JSON.stringify(responseJson),
          nextDue ? toDateTimeSql(nextDue) : null,
          automaticTrigger ? nextAttempts : Number(row.check_attempts || 0),
          isDelayed ? 1 : 0,
          toDateTimeSql(now),
          toDateTimeSql(now),
          automaticTrigger ? 1 : 0,
          automaticTrigger ? null : toDateTimeSql(now),
          automaticTrigger ? 1 : 0,
          automaticTrigger ? null : motStatus,
          automaticTrigger ? 1 : 0,
          automaticTrigger ? null : motStatusLabel,
          automaticTrigger ? 1 : 0,
          automaticTrigger ? null : JSON.stringify(responseJson),
          complete ? `MOT check completed: ${motStatusLabel}.` : `MOT check complete: ${motStatusLabel}.`,
          checkId,
        ],
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
          toDateOnlySql(latestTest.date),
          latestTest.result || null,
          toDateOnlySql(latestTest.expiry),
          toInt(summary.failures_count, failures.length),
          toInt(summary.minors_count, minors.length),
          toInt(summary.advisories_count, advisories.length),
          JSON.stringify(responseJson),
          nextDue ? toDateTimeSql(nextDue) : null,
          automaticTrigger ? nextAttempts : Number(row.check_attempts || 0),
          isDelayed ? 1 : 0,
          toDateTimeSql(now),
          toDateTimeSql(now),
          checkId,
        ],
      )
    } else {
      await runWithFallback(
        tx,
        `UPDATE mot_result_checks
         SET mot_status = ?, mot_status_label = ?,
             latest_test_date = ?, latest_test_result = ?, latest_test_expiry = ?,
             failures_count = ?, minors_count = ?, advisories_count = ?,
             raw_response_json = ?, last_manual_checked_at = ?,
             last_manual_status = ?, last_manual_status_label = ?, last_manual_response_json = ?,
             last_action_message = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          motStatus || null,
          motStatusLabel || null,
          toDateOnlySql(latestTest.date),
          latestTest.result || null,
          toDateOnlySql(latestTest.expiry),
          toInt(summary.failures_count, failures.length),
          toInt(summary.minors_count, minors.length),
          toInt(summary.advisories_count, advisories.length),
          JSON.stringify(responseJson),
          toDateTimeSql(now),
          motStatus || null,
          motStatusLabel || null,
          JSON.stringify(responseJson),
          `Manual MOT check completed: ${motStatusLabel}. Automatic timing unchanged.`,
          checkId,
        ],
        `UPDATE mot_result_checks
         SET mot_status = ?, mot_status_label = ?,
             latest_test_date = ?, latest_test_result = ?, latest_test_expiry = ?,
             failures_count = ?, minors_count = ?, advisories_count = ?,
             raw_response_json = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          motStatus || null,
          motStatusLabel || null,
          toDateOnlySql(latestTest.date),
          latestTest.result || null,
          toDateOnlySql(latestTest.expiry),
          toInt(summary.failures_count, failures.length),
          toInt(summary.minors_count, minors.length),
          toInt(summary.advisories_count, advisories.length),
          JSON.stringify(responseJson),
          checkId,
        ],
      )
    }

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
    } else if (automaticTrigger && isDelayed && !row.delayed_at) {
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
    return { row: updated, response: responseJson, trigger, automatic_schedule_preserved: !automaticTrigger && !complete }
  })
}

let motScheduler = null
let motSchedulerRunning = false

async function getDueMotRows(db, settings, limit = 20) {
  return db.all(
    `SELECT * FROM mot_result_checks
     WHERE arrived_at IS NOT NULL
       AND next_check_at IS NOT NULL
       AND next_check_at <= UTC_TIMESTAMP()
       AND status NOT IN ('complete', 'failed')
       AND check_attempts < ?
     ORDER BY next_check_at ASC
     LIMIT ?`,
    [Math.max(1, settings.max_checks_per_mot), Math.max(1, limit)],
  ).catch(() => [])
}

async function processDueMotChecks(db, opts = {}) {
  const settings = await getMotSettings(db)
  const dueRows = await getDueMotRows(db, settings, opts.limit || 20)
  const out = { processed: 0, completed: 0, delayed: 0, errors: 0, due_count: dueRows.length }
  for (const row of dueRows || []) {
    try {
      const result = await runMotCheckNow(db, row.id, 'scheduler')
      out.processed += 1
      const status = String(result?.row?.status || '').toLowerCase()
      if (status === 'complete' || status === 'failed') out.completed += 1
      if (status === 'delayed') out.delayed += 1
    } catch (err) {
      out.errors += 1
      // eslint-disable-next-line no-console
      console.error('[MOT scheduler] due-check error', {
        check_id: row.id,
        error: String(err && err.message ? err.message : err),
      })
    }
  }
  return out
}

function startMotScheduler({ db }) {
  if (motScheduler) return
  // eslint-disable-next-line no-console
  console.log('[MOT scheduler] started.')
  async function tick() {
    if (motSchedulerRunning) return
    motSchedulerRunning = true
    let intervalSeconds = 60
    try {
      const settings = await getMotSettings(db)
      intervalSeconds = Math.max(15, Number(settings.scheduler_interval_seconds || 60))
      if (!settings.scheduler_enabled) return
      await processDueMotChecks(db, { limit: Math.max(1, settings.max_checks_per_mot) })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MOT scheduler] tick failed', String(err && err.message ? err.message : err))
    } finally {
      motSchedulerRunning = false
      motScheduler = setTimeout(tick, intervalSeconds * 1000)
    }
  }
  motScheduler = setTimeout(tick, 1000)
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

  router.post('/mot/checks/quick-add', async (req, res) => {
    const body = req.body || {}
    const registration = normaliseRegistration(body.registration)
    if (!registration) return res.status(400).json({ ok: false, error: 'registration is required.' })
    const hasBookedStart = Boolean(body.booked_start && String(body.booked_start).trim())
    const manualOnly = body.manual_only == null ? !hasBookedStart : toBool(body.manual_only, true)
    const status = manualOnly ? 'manual_watch' : 'booked'
    const pollingInterval = Math.max(0, toInt(body.polling_interval_minutes, 0))

    let created
    try {
      created = await db.run(
        `INSERT INTO mot_result_checks (job_id, vehicle_id, registration, booked_start, status, source, notes, polling_interval_minutes)
         VALUES (?, ?, ?, ?, ?, 'quick_add', ?, ?)`,
        [
          body.job_id ? toInt(body.job_id, null) : null,
          body.vehicle_id ? toInt(body.vehicle_id, null) : null,
          registration,
          hasBookedStart ? String(body.booked_start).trim() : null,
          status,
          body.notes ? String(body.notes).trim().slice(0, 2000) : null,
          pollingInterval,
        ],
      )
    } catch (err) {
      const code = String(err && err.code ? err.code : '')
      const msg = String(err && err.message ? err.message : '')
      if (code === 'ER_BAD_FIELD_ERROR' || /Unknown column/i.test(msg)) {
        created = await db.run(
          `INSERT INTO mot_result_checks (job_id, vehicle_id, registration, booked_start, status, source, notes)
           VALUES (?, ?, ?, ?, ?, 'quick_add', ?)`,
          [
            body.job_id ? toInt(body.job_id, null) : null,
            body.vehicle_id ? toInt(body.vehicle_id, null) : null,
            registration,
            hasBookedStart ? String(body.booked_start).trim() : null,
            status,
            body.notes ? String(body.notes).trim().slice(0, 2000) : null,
          ],
        )
      } else {
        throw err
      }
    }
    const check = await db.get(`SELECT * FROM mot_result_checks WHERE id = ?`, [created.lastInsertId])
    res.status(201).json({ ok: true, check, message: `${registration} added to MOT list.` })
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
      if (result && result.error) {
        return res.status(502).json({
          ok: false,
          error: 'MOT check webhook request failed.',
          details: String(result.error),
          check: result.row || null,
        })
      }
      res.json({ ok: true, ...result })
    } catch (err) {
      const status = Number(err && err.status) || 500
      const details = String(err && err.message ? err.message : err)
      // eslint-disable-next-line no-console
      console.error('[MOT run-now] failed', { check_id: id, status, details })
      res.status(status).json({
        ok: false,
        error: 'Failed to run MOT check now.',
        details,
      })
    }
  })

  router.post('/mot/checks/:id/create-quote', async (req, res) => {
    const checkId = toInt(req.params.id, 0)
    if (!checkId) return res.status(400).json({ ok: false, error: 'Invalid MOT check id.' })
    const body = req.body || {}
    try {
      const out = await db.transaction((tx) => createQuoteFromMotCheck(tx, {
        checkId,
        selectedFaults: Array.isArray(body.selected_faults) ? body.selected_faults : [],
        quoteTitle: body.quote_title || 'MOT Repair Quote',
        optionalJobId: body.job_id,
        createJobIfMissing: toBool(body.create_job_if_missing, false),
      }))
      res.status(201).json({
        ok: true,
        quote: out.quote,
        linked_job_id: out.linked_job_id,
        action_url: `/quotes/${out.quote.id}`,
        message: `Draft MOT repair quote created: ${out.quote.quote_number}`,
      })
    } catch (err) {
      const status = Number(err && err.status) || 500
      res.status(status).json({ ok: false, error: String(err.message || 'Failed to create MOT repair quote.') })
    }
  })

  router.post('/mot/manual-check', async (req, res) => {
    const body = req.body || {}
    const registration = normaliseRegistration(body.registration)
    const checkId = toInt(body.mot_result_check_id, 0)
    const jobId = toInt(body.job_id, 0)

    if (checkId > 0) {
      try {
        const result = await runMotCheckNow(db, checkId, 'manual')
        if (result && result.error) {
          return res.status(502).json({
            ok: false,
            error: 'MOT check webhook request failed.',
            details: String(result.error),
            check: result.row || null,
          })
        }
        return res.json({ ok: true, ...result })
      } catch (err) {
        const status = Number(err && err.status) || 500
        const details = String(err && err.message ? err.message : err)
        // eslint-disable-next-line no-console
        console.error('[MOT manual-check] linked check failed', { check_id: checkId, status, details })
        return res.status(status).json({ ok: false, error: 'Failed manual MOT check.', details })
      }
    }

    if (!registration) {
      return res.status(400).json({ ok: false, error: 'registration or mot_result_check_id is required.' })
    }

    try {
      const settings = await getMotSettings(db)
      const payload = {
        registration,
        job_id: jobId || null,
        booked_start: null,
        mot_result_check_id: null,
      }
      const response = await fetch(settings.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await response.text()
      let responseJson = null
      try {
        responseJson = text ? JSON.parse(text) : null
      } catch {
        responseJson = null
      }
      if (!response.ok || !responseJson) {
        return res.status(502).json({ ok: false, error: 'MOT webhook returned non-success response.', details: `HTTP ${response.status}` })
      }
      const motStatus = String(responseJson.mot_status || 'unknown').trim().toLowerCase()
      const motStatusLabel = String(responseJson.mot_status_label || motStatus || 'Unknown').trim()
      return res.json({
        ok: true,
        manual_only: true,
        automatic_schedule_changed: false,
        result: {
          registration,
          mot_status: motStatus,
          mot_status_label: motStatusLabel,
          latest_test: responseJson.latest_test || null,
          summary: responseJson.summary || null,
          failures: Array.isArray(responseJson.failures) ? responseJson.failures : [],
          minors: Array.isArray(responseJson.minors) ? responseJson.minors : [],
          advisories: Array.isArray(responseJson.advisories) ? responseJson.advisories : [],
          raw_response: responseJson,
        },
      })
    } catch (err) {
      const details = String(err && err.message ? err.message : err)
      // eslint-disable-next-line no-console
      console.error('[MOT manual-check] ad-hoc registration failed', { registration, details })
      return res.status(500).json({ ok: false, error: 'Failed manual MOT check.', details })
    }
  })

  router.post('/mot/process-due', async (_req, res) => {
    try {
      const out = await processDueMotChecks(db, { limit: 50 })
      return res.json({ ok: true, ...out })
    } catch (err) {
      const details = String(err && err.message ? err.message : err)
      return res.status(500).json({ ok: false, error: 'Failed to process due MOT checks.', details })
    }
  })

  router.get('/mot/scheduler-status', async (_req, res) => {
    try {
      const settings = await getMotSettings(db)
      const dueCountRow = await db.get(
        `SELECT COUNT(*) AS count FROM mot_result_checks
         WHERE arrived_at IS NOT NULL
           AND next_check_at IS NOT NULL
           AND next_check_at <= UTC_TIMESTAMP()
           AND status NOT IN ('complete', 'failed')
           AND check_attempts < ?`,
        [Math.max(1, settings.max_checks_per_mot)],
      ).catch(() => ({ count: 0 }))
      const nextDue = await db.get(
        `SELECT next_check_at FROM mot_result_checks
         WHERE arrived_at IS NOT NULL
           AND next_check_at IS NOT NULL
           AND status NOT IN ('complete', 'failed')
         ORDER BY next_check_at ASC
         LIMIT 1`,
      ).catch(() => null)
      return res.json({
        ok: true,
        scheduler_enabled: Boolean(settings.scheduler_enabled),
        interval_seconds: Number(settings.scheduler_interval_seconds || 60),
        due_count: Number((dueCountRow && dueCountRow.count) || 0),
        next_due_at: nextDue ? nextDue.next_check_at : null,
        current_server_time: new Date().toISOString(),
      })
    } catch (err) {
      const details = String(err && err.message ? err.message : err)
      return res.status(500).json({ ok: false, error: 'Failed to load scheduler status.', details })
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
