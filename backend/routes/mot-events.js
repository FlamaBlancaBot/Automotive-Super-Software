'use strict'

const express = require('express')
const { normaliseRegistration } = require('../db/utils')
const { logActivity } = require('../lib/activity')

function toInt(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function safeJson(value, fallback = []) {
  try {
    if (value == null) return fallback
    if (Array.isArray(value)) return value
    if (typeof value === 'string') return JSON.parse(value)
    return value
  } catch {
    return fallback
  }
}

function createMotEventsRouter({ db }) {
  const router = express.Router()

  router.get('/mot-events', async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const date = String(req.query.date || '').trim()
    const jobId = toInt(req.query.job_id, 0)
    const vehicleId = toInt(req.query.vehicle_id, 0)

    const where = []
    const params = []
    if (status) {
      where.push('LOWER(me.status) = ?')
      params.push(status)
    }
    if (date) {
      where.push('DATE(me.mot_time) = ?')
      params.push(date)
    }
    if (jobId) {
      where.push('me.job_id = ?')
      params.push(jobId)
    }
    if (vehicleId) {
      where.push('me.vehicle_id = ?')
      params.push(vehicleId)
    }

    const rows = await db.all(
      `
      SELECT
        me.*,
        j.title AS job_title,
        j.status AS job_status,
        v.registration,
        v.make,
        v.model,
        c.first_name,
        c.surname,
        s.name AS supplier_name
      FROM mot_events me
      JOIN jobs j ON j.id = me.job_id
      JOIN vehicles v ON v.id = me.vehicle_id
      JOIN customers c ON c.id = j.customer_id
      LEFT JOIN suppliers s ON s.id = me.supplier_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY me.mot_time DESC, me.id DESC
      LIMIT 300
    `,
      params,
    )

    res.json({
      ok: true,
      mot_events: (rows || []).map((row) => ({
        ...row,
        failures: safeJson(row.failures_json, []),
        advisories: safeJson(row.advisories_json, []),
        minors: safeJson(row.minors_json, []),
      })),
    })
  })

  router.post('/mot-events/:id/check-result', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid MOT event id.' })

    const motEvent = await db.get(
      `
      SELECT me.*, v.registration
      FROM mot_events me
      JOIN vehicles v ON v.id = me.vehicle_id
      WHERE me.id = ?
      LIMIT 1
    `,
      [id],
    )
    if (!motEvent) return res.status(404).json({ ok: false, error: 'MOT event not found.' })

    const regNorm = normaliseRegistration(motEvent.registration)
    if (!regNorm) {
      return res.status(400).json({ ok: false, error: 'Linked vehicle registration is invalid.' })
    }

    let refreshResponse = null
    try {
      refreshResponse = await fetch(
        `${req.protocol}://${req.get('host')}/api/vehicles/${encodeURIComponent(regNorm)}/refresh`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      )
    } catch {
      refreshResponse = null
    }

    let refreshJson = null
    try {
      refreshJson = refreshResponse ? await refreshResponse.json() : null
    } catch {
      refreshJson = null
    }

    const motTests = safeJson(refreshJson && refreshJson.vehicle && refreshJson.vehicle.mot_tests_json, [])
    const latestTest = Array.isArray(motTests) && motTests.length ? motTests[0] : null
    const latestResult = latestTest && latestTest.testResult ? String(latestTest.testResult).toLowerCase() : ''
    const status =
      latestResult === 'pass'
        ? 'passed'
        : latestResult === 'fail'
          ? 'failed'
          : 'checking_result'

    const failures = latestTest && Array.isArray(latestTest.rfrAndComments) ? latestTest.rfrAndComments : []
    const advisories = latestTest && Array.isArray(latestTest.advisoryNoticeItems) ? latestTest.advisoryNoticeItems : []
    const minors = latestTest && Array.isArray(latestTest.minorDefects) ? latestTest.minorDefects : []
    const nextCheckAt =
      status === 'checking_result'
        ? new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
        : null

    await db.run(
      `
      UPDATE mot_events
      SET
        status = ?,
        result = ?,
        result_checked_at = CURRENT_TIMESTAMP,
        next_check_at = ?,
        failures_json = ?,
        advisories_json = ?,
        minors_json = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        status,
        status === 'passed' ? 'passed' : status === 'failed' ? 'failed' : null,
        nextCheckAt,
        failures.length ? JSON.stringify(failures) : null,
        advisories.length ? JSON.stringify(advisories) : null,
        minors.length ? JSON.stringify(minors) : null,
        id,
      ],
    )

    const updated = await db.get(`SELECT * FROM mot_events WHERE id = ?`, [id])

    await logActivity(db, {
      userId: req.authUser ? req.authUser.id : null,
      entityType: 'mot_event',
      entityId: id,
      action: 'mot_result_checked',
      summary: `MOT RESULT CHECKED: ${status.toUpperCase()} (${regNorm})`,
      metadata: { mot_event_id: id, status },
    })

    res.json({
      ok: true,
      mot_event: {
        ...updated,
        failures: safeJson(updated.failures_json, []),
        advisories: safeJson(updated.advisories_json, []),
        minors: safeJson(updated.minors_json, []),
      },
      refresh_ok: Boolean(refreshJson && refreshJson.ok),
      suggested_next:
        status === 'failed'
          ? 'Create repair quote'
          : status === 'passed'
            ? 'Mark MOT complete'
            : 'Check again in 10 minutes',
    })
  })

  router.post('/mot-events/:id/create-repair-quote', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid MOT event id.' })

    const event = await db.get(
      `
      SELECT me.*, j.customer_id, j.vehicle_id, j.id AS job_id, j.title
      FROM mot_events me
      JOIN jobs j ON j.id = me.job_id
      WHERE me.id = ?
      LIMIT 1
    `,
      [id],
    )
    if (!event) return res.status(404).json({ ok: false, error: 'MOT event not found.' })

    const existing = await db.get(
      `SELECT id, quote_number FROM quotes WHERE job_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1`,
      [event.job_id],
    )
    if (existing) return res.json({ ok: true, reused: true, quote_id: existing.id, quote_number: existing.quote_number })

    const year = new Date().getFullYear()
    const row = await db.get(
      `SELECT COUNT(*) AS count FROM quotes WHERE quote_number LIKE ?`,
      [`Q-${year}-%`],
    )
    const seq = Number(row && row.count ? row.count : 0) + 1
    const quoteNumber = `Q-${year}-${String(seq).padStart(4, '0')}`
    const title = `MOT REPAIR - ${String(event.title || 'JOB').toUpperCase()}`
    const created = await db.run(
      `
      INSERT INTO quotes (
        quote_number, customer_id, vehicle_id, job_id, status, title,
        subtotal_cost, subtotal_sell, vat_rate, vat_amount, total_sell, estimated_margin,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'draft', ?, 0, 0, 0.2, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
      [quoteNumber, event.customer_id, event.vehicle_id, event.job_id, title],
    )

    const quoteId = created.lastInsertId
    const failures = safeJson(event.failures_json, [])
    for (const failure of failures) {
      const text = String(
        (failure && (failure.text || failure.defectText || failure.deficiencyText)) || 'MOT FAILURE ITEM',
      )
      const existingLine = await db.get(
        `SELECT id FROM quote_items WHERE quote_id = ? AND item_type = 'mot_repair' AND description = ? LIMIT 1`,
        [quoteId, text.toUpperCase()],
      )
      if (existingLine) continue
      await db.run(
        `
        INSERT INTO quote_items (
          quote_id, item_type, description, quantity, unit_cost, unit_sell,
          vat_rate, total_cost, total_sell, selected_for_quote, sort_order,
          created_at, updated_at
        ) VALUES (?, 'mot_repair', ?, 1, 0, 0, 0.2, 0, 0, 1, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
        [quoteId, text.toUpperCase()],
      )
    }

    await logActivity(db, {
      userId: req.authUser ? req.authUser.id : null,
      entityType: 'quote',
      entityId: quoteId,
      action: 'quote_created_from_mot',
      summary: `REPAIR QUOTE CREATED FROM MOT EVENT #${id}`,
      metadata: { mot_event_id: id, job_id: event.job_id },
    })

    res.status(201).json({ ok: true, quote_id: quoteId, quote_number: quoteNumber, reused: false })
  })

  return router
}

module.exports = {
  createMotEventsRouter,
}

