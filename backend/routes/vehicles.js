'use strict'

const express = require('express')
const { normaliseRegistration, isLikelyUkRegistration } = require('../db/utils')

function getEnv(name) {
  const v = process.env[name]
  return v ? String(v).trim() : ''
}

function extractRegistrationCandidate(input) {
  if (typeof input === 'string') return input
  if (!input || typeof input !== 'object') return ''
  if (typeof input.registration === 'string') return input.registration
  if (typeof input.reg === 'string') return input.reg
  if (input.vehicle && typeof input.vehicle === 'object' && typeof input.vehicle.registration === 'string') {
    return input.vehicle.registration
  }
  return ''
}

async function fetchJsonWithTimeout(url, options, timeoutMs) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch() is not available in this Node.js runtime.')
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { ok: res.ok, status: res.status, json, text }
  } finally {
    clearTimeout(t)
  }
}

function mapN8nVehicleToDbRow(vehicle) {
  const v = vehicle || {}
  const regNorm = normaliseRegistration(v.registration)
  if (!regNorm) return null

  return {
    registration: regNorm,
    make: v.make ? String(v.make) : null,
    model: v.model ? String(v.model) : null,
    year: v.year != null ? String(v.year) : null,
    fuel_type: v.fuel_type ? String(v.fuel_type) : null,
    engine_size: v.engine_size ? String(v.engine_size) : null,
    colour: v.colour ? String(v.colour) : null,
    mot_status: v.mot_status ? String(v.mot_status) : null,
    mot_expiry: v.mot_expiry ? String(v.mot_expiry) : null,
    last_mot_date: v.last_mot_date ? String(v.last_mot_date) : null,
    last_recorded_mileage:
      v.last_recorded_mileage != null ? String(v.last_recorded_mileage) : null,
  }
}

async function upsertVehicleByRegistration(db, regNorm, row) {
  return db.transaction(async (tx) => {
    const existing = await tx.get(
      `
      SELECT id
      FROM vehicles
      WHERE upper(replace(registration, ' ', '')) = ?
      LIMIT 1
    `,
      [regNorm],
    )

    if (existing && existing.id) {
      await tx.run(
        `
        UPDATE vehicles
        SET
          registration = ?,
          make = ?,
          model = ?,
          year = ?,
          fuel_type = ?,
          engine_size = ?,
          colour = ?,
          mot_status = ?,
          mot_expiry = ?,
          last_mot_date = ?,
          last_recorded_mileage = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        [
          row.registration,
          row.make,
          row.model,
          row.year,
          row.fuel_type,
          row.engine_size,
          row.colour,
          row.mot_status,
          row.mot_expiry,
          row.last_mot_date,
          row.last_recorded_mileage,
          existing.id,
        ],
      )
      return tx.get(`SELECT * FROM vehicles WHERE id = ?`, [existing.id])
    }

    const created = await tx.run(
      `
      INSERT INTO vehicles (
        registration, make, model, year, fuel_type, engine_size, colour,
        mot_status, mot_expiry, last_mot_date, last_recorded_mileage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        row.registration,
        row.make,
        row.model,
        row.year,
        row.fuel_type,
        row.engine_size,
        row.colour,
        row.mot_status,
        row.mot_expiry,
        row.last_mot_date,
        row.last_recorded_mileage,
      ],
    )
    return tx.get(`SELECT * FROM vehicles WHERE id = ?`, [created.lastInsertId])
  })
}

function isLookupStale(lastLookupAt, maxDays = 30) {
  if (!lastLookupAt) return true
  const then = new Date(lastLookupAt)
  if (Number.isNaN(then.getTime())) return true
  const ageMs = Date.now() - then.getTime()
  return ageMs > maxDays * 24 * 60 * 60 * 1000
}

function recommendationTemplatesFromText(text, registrationNorm, createdFromJobId = null) {
  const t = String(text || '').toLowerCase()
  const now = new Date()
  const plusMonths = (m) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() + m)
    return d.toISOString().slice(0, 10)
  }
  const recs = []
  if (t.includes('brake')) {
    recs.push({
      recommendation_type: 'inspection',
      title: 'Brake inspection due',
      description: 'Recommended follow-up brake inspection based on previous brake-related work.',
      due_date: plusMonths(6),
      due_mileage: null,
      priority: 'medium',
      source: 'rule_based',
      created_from_job_id: createdFromJobId,
      status: 'open',
      registration: registrationNorm,
    })
  }
  if (t.includes('oil') || t.includes('service')) {
    recs.push({
      recommendation_type: 'service',
      title: 'Next service reminder',
      description: 'Generic recommendation: next service in 12 months or around 10,000 miles.',
      due_date: plusMonths(12),
      due_mileage: 10000,
      priority: 'medium',
      source: 'rule_based',
      created_from_job_id: createdFromJobId,
      status: 'open',
      registration: registrationNorm,
    })
  }
  if (t.includes('mot')) {
    recs.push({
      recommendation_type: 'mot',
      title: 'MOT planning reminder',
      description: 'Generic reminder to plan upcoming MOT check and pre-inspection.',
      due_date: plusMonths(11),
      due_mileage: null,
      priority: 'high',
      source: 'rule_based',
      created_from_job_id: createdFromJobId,
      status: 'open',
      registration: registrationNorm,
    })
  }
  if (t.includes('timing belt') || t.includes('cambelt')) {
    recs.push({
      recommendation_type: 'interval_check',
      title: 'Timing belt interval check',
      description: 'Generic timing belt/cambelt interval check recommendation.',
      due_date: plusMonths(12),
      due_mileage: null,
      priority: 'high',
      source: 'rule_based',
      created_from_job_id: createdFromJobId,
      status: 'open',
      registration: registrationNorm,
    })
  }
  if (t.includes('air conditioning') || t.includes('air con')) {
    recs.push({
      recommendation_type: 'inspection',
      title: 'Annual A/C check',
      description: 'Generic recommendation for annual air-conditioning performance check.',
      due_date: plusMonths(12),
      due_mileage: null,
      priority: 'low',
      source: 'rule_based',
      created_from_job_id: createdFromJobId,
      status: 'open',
      registration: registrationNorm,
    })
  }
  return recs
}

async function safeAll(db, sql, params = [], fallback = []) {
  try {
    return await db.all(sql, params)
  } catch (err) {
    const code = String(err && err.code ? err.code : '')
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return fallback
    throw err
  }
}

async function safeGet(db, sql, params = [], fallback = null) {
  try {
    return await db.get(sql, params)
  } catch (err) {
    const code = String(err && err.code ? err.code : '')
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return fallback
    throw err
  }
}

async function updateLookupMeta(db, vehicleId, fields) {
  await db.run(
    `UPDATE vehicles
     SET
       last_lookup_at = COALESCE(?, last_lookup_at),
       lookup_source = COALESCE(?, lookup_source),
       lookup_error = ?,
       mot_tests_json = COALESCE(?, mot_tests_json),
       mot_failures_json = COALESCE(?, mot_failures_json),
       mot_advisories_json = COALESCE(?, mot_advisories_json),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      fields.last_lookup_at || null,
      fields.lookup_source || null,
      fields.lookup_error || null,
      fields.mot_tests_json || null,
      fields.mot_failures_json || null,
      fields.mot_advisories_json || null,
      vehicleId,
    ],
  )
}

async function lookupVehicleFromWebhook(regNorm) {
  const webhookUrl =
    getEnv('N8N_CHECK_VEHICLE_WEBHOOK_URL') ||
    'https://automationplatform.business-automations.uk/webhook/checkvehiclecreate'
  if (!webhookUrl) {
    return { ok: false, type: 'config', message: 'Vehicle lookup webhook is not configured.' }
  }

  const sharedSecret = getEnv('N8N_CHECK_VEHICLE_SHARED_SECRET')
  const headers = { 'Content-Type': 'application/json' }
  if (sharedSecret) headers['X-AUTOSS-WEBHOOK-SECRET'] = sharedSecret
  // eslint-disable-next-line no-console
  console.log(`Vehicle lookup webhook attempted for REG: ${regNorm}`)

  const webhookRes = await fetchJsonWithTimeout(
    webhookUrl,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ registration: regNorm }),
    },
    20_000,
  )

  if (!webhookRes.ok) {
    return {
      ok: false,
      type: 'webhook_error',
      status: webhookRes.status,
      message: 'Vehicle lookup webhook returned an error.',
    }
  }

  const payload = webhookRes.json
  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      type: 'webhook_error',
      message: 'Vehicle lookup webhook returned an unexpected response.',
    }
  }
  if (!payload.vehicle) {
    return { ok: true, found: false, payload }
  }
  const mapped = mapN8nVehicleToDbRow(payload.vehicle)
  if (!mapped) {
    return {
      ok: false,
      type: 'webhook_error',
      message: 'Vehicle lookup webhook response missing a valid registration.',
    }
  }
  return { ok: true, found: true, payload, mapped }
}

function createVehiclesRouter({ db }) {
  const router = express.Router()

  // Simple list/search for UI pages (Vehicles, global search helpers).
  router.get('/', async (req, res) => {
    const q = String(req.query.q || '').trim()
    const like = q ? `%${q}%` : null
    const noSpaces = q ? q.replace(/\s+/g, '') : ''
    const likeNoSpaces = q ? `%${noSpaces}%` : null

    try {
      const rows = await db.all(
        `
        SELECT id, registration, make, model, year, fuel_type, colour, mot_status, mot_expiry, updated_at
        FROM vehicles
        ${q ? `WHERE registration LIKE ?
              OR UPPER(REPLACE(registration, ' ', '')) LIKE UPPER(?)
              OR make LIKE ?
              OR model LIKE ?
              OR colour LIKE ?` : ''}
        ORDER BY updated_at DESC, id DESC
        LIMIT 200
      `,
        q ? [like, likeNoSpaces, like, like, like] : [],
      )
      res.json({ ok: true, vehicles: rows || [] })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load vehicles.' })
    }
  })

  router.get('/:registration/matches', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!isLikelyUkRegistration(regNorm)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid registration. Enter 2–8 letters/numbers.',
      })
    }

    const vehicle = await db.get(
      `
      SELECT *
      FROM vehicles
      WHERE upper(replace(registration, ' ', '')) = ?
      LIMIT 1
    `,
      [regNorm],
    )

    if (!vehicle) {
      try {
        const webhookLookup = await lookupVehicleFromWebhook(regNorm)
        if (!webhookLookup.ok) {
          const status = webhookLookup.type === 'webhook_error' ? 502 : 500
          return res.status(status).json({
            ok: false,
            error: webhookLookup.message || 'Vehicle lookup webhook failed.',
            source: webhookLookup.type || 'webhook_error',
            webhook_attempted: true,
          })
        }
        if (!webhookLookup.found) {
          return res.json({
            ok: true,
            found: false,
            source: 'not_found',
            webhook_attempted: true,
            message:
              'Vehicle not found locally yet. DVLA/DVSA lookup may not have returned a match.',
            vehicle: null,
            customers: [],
          })
        }
        const saved = await upsertVehicleByRegistration(db, regNorm, webhookLookup.mapped)
        await updateLookupMeta(db, saved.id, {
          last_lookup_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
          lookup_source: 'webhook',
          lookup_error: null,
          mot_tests_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.tests) || []),
          mot_failures_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.failures) || []),
          mot_advisories_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.advisories) || []),
        })
        const refreshed = await db.get(`SELECT * FROM vehicles WHERE id = ?`, [saved.id])
        return res.json({
          ok: true,
          found: true,
          source: 'webhook',
          webhook_attempted: true,
          refresh_attempted: true,
          vehicle: refreshed,
          customers: [],
          mot: webhookLookup.payload.mot || null,
        })
      } catch (err) {
        const isAbort =
          err && (String(err.name) === 'AbortError' || String(err.message).includes('aborted'))
        return res.status(isAbort ? 504 : 502).json({
          ok: false,
          source: 'webhook_error',
          webhook_attempted: true,
          error: isAbort
            ? 'Vehicle lookup webhook timed out.'
            : 'Vehicle lookup webhook failed.',
        })
      }
    }

    const customers = await db.all(
      `
      SELECT c.id, c.first_name, c.surname, c.phone,
             cv.relationship_status, cv.is_current_owner, cv.created_at as linked_at
      FROM customer_vehicles cv
      JOIN customers c ON c.id = cv.customer_id
      WHERE cv.vehicle_id = ?
      ORDER BY cv.is_current_owner DESC, cv.created_at DESC
    `,
      [vehicle.id],
    )

    const stale = isLookupStale(vehicle.last_lookup_at, 30)
    if (stale) {
      try {
        const webhookLookup = await lookupVehicleFromWebhook(regNorm)
        if (webhookLookup.ok && webhookLookup.found) {
          const saved = await upsertVehicleByRegistration(db, regNorm, webhookLookup.mapped)
          await updateLookupMeta(db, saved.id, {
            last_lookup_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            lookup_source: 'webhook',
            lookup_error: null,
            mot_tests_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.tests) || []),
            mot_failures_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.failures) || []),
            mot_advisories_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.advisories) || []),
          })
          const refreshed = await db.get(`SELECT * FROM vehicles WHERE id = ?`, [saved.id])
          return res.json({
            ok: true,
            found: true,
            source: 'webhook',
            webhook_attempted: true,
            refresh_attempted: true,
            vehicle: refreshed,
            customers,
            mot: webhookLookup.payload.mot || null,
          })
        }
        await updateLookupMeta(db, vehicle.id, {
          lookup_source: 'database_stale',
          lookup_error:
            (webhookLookup && webhookLookup.message) || 'Webhook refresh did not return updated vehicle data.',
        })
        return res.json({
          ok: true,
          found: true,
          source: 'database_stale',
          webhook_attempted: true,
          refresh_attempted: true,
          refresh_error:
            (webhookLookup && webhookLookup.message) || 'Webhook refresh did not return updated data.',
          vehicle,
          customers,
        })
      } catch (err) {
        await updateLookupMeta(db, vehicle.id, {
          lookup_source: 'database_stale',
          lookup_error: 'Vehicle refresh failed.',
        }).catch(() => {})
        return res.json({
          ok: true,
          found: true,
          source: 'database_stale',
          webhook_attempted: true,
          refresh_attempted: true,
          refresh_error: 'Vehicle refresh failed.',
          vehicle,
          customers,
        })
      }
    }

    res.json({
      ok: true,
      found: true,
      source: 'database',
      webhook_attempted: false,
      refresh_attempted: false,
      vehicle,
      customers,
    })
  })

  router.post('/:registration/refresh', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!isLikelyUkRegistration(regNorm)) {
      return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    }

    const vehicle = await db.get(
      `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`,
      [regNorm],
    )

    try {
      const webhookLookup = await lookupVehicleFromWebhook(regNorm)
      if (!webhookLookup.ok) {
        return res.status(502).json({
          ok: false,
          error: webhookLookup.message || 'Vehicle refresh failed.',
          source: 'webhook_error',
          webhook_attempted: true,
        })
      }
      if (!webhookLookup.found) {
        return res.status(404).json({
          ok: false,
          error: 'Vehicle not found from webhook lookup.',
          source: 'not_found',
          webhook_attempted: true,
        })
      }
      const saved = await upsertVehicleByRegistration(db, regNorm, webhookLookup.mapped)
      await updateLookupMeta(db, saved.id, {
        last_lookup_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        lookup_source: 'webhook',
        lookup_error: null,
        mot_tests_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.tests) || []),
        mot_failures_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.failures) || []),
        mot_advisories_json: JSON.stringify((webhookLookup.payload.mot && webhookLookup.payload.mot.advisories) || []),
      })
      const refreshed = await db.get(`SELECT * FROM vehicles WHERE id = ?`, [saved.id])
      return res.json({
        ok: true,
        source: 'webhook',
        refresh_attempted: true,
        webhook_attempted: true,
        vehicle: refreshed,
        previous_vehicle_id: vehicle ? vehicle.id : null,
      })
    } catch (err) {
      return res.status(502).json({
        ok: false,
        source: 'webhook_error',
        webhook_attempted: true,
        error: 'Vehicle refresh failed.',
      })
    }
  })

  router.get('/:registration/history', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!regNorm) return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    try {
      const vehicle = await safeGet(
        db,
        `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`,
        [regNorm],
        null,
      )
      const vehicleId = vehicle ? Number(vehicle.id) : 0
      const rows = await safeAll(
        db,
        `SELECT *
         FROM vehicle_service_events
         WHERE upper(replace(registration, ' ', '')) = ?
            OR (? > 0 AND vehicle_id = ?)
         ORDER BY COALESCE(event_date, created_at) DESC, id DESC
         LIMIT 300`,
        [regNorm, vehicleId, vehicleId],
        [],
      )
      res.json({ ok: true, registration: regNorm, events: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load vehicle history.' })
    }
  })

  router.post('/:registration/history', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!regNorm) return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    const body = req.body || {}
    const title = String(body.title || '').trim()
    const eventType = String(body.event_type || 'manual_note').trim().toLowerCase()
    if (!title) return res.status(400).json({ ok: false, error: 'title is required.' })
    try {
      const vehicle = await safeGet(
        db,
        `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`,
        [regNorm],
        null,
      )
      const created = await db.run(
        `INSERT INTO vehicle_service_events
         (vehicle_id, registration, job_id, quote_id, invoice_id, event_type, title, description, mileage, event_date, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vehicle ? vehicle.id : null,
          regNorm,
          body.job_id || null,
          body.quote_id || null,
          body.invoice_id || null,
          eventType,
          title,
          body.description ? String(body.description) : null,
          body.mileage != null && body.mileage !== '' ? Number(body.mileage) : null,
          body.event_date ? String(body.event_date) : null,
          body.source ? String(body.source) : 'manual',
        ],
      )
      const event = await db.get(`SELECT * FROM vehicle_service_events WHERE id = ?`, [created.lastInsertId])
      const autoRecs = recommendationTemplatesFromText(`${eventType} ${title} ${event.description || ''}`, regNorm, event.job_id || null)
      for (const rec of autoRecs) {
        await db.run(
          `INSERT INTO vehicle_maintenance_recommendations
           (vehicle_id, registration, recommendation_type, title, description, due_mileage, due_date, priority, status, source, created_from_job_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            vehicle ? vehicle.id : null,
            regNorm,
            rec.recommendation_type,
            rec.title,
            rec.description,
            rec.due_mileage,
            rec.due_date,
            rec.priority,
            rec.status,
            rec.source,
            rec.created_from_job_id,
          ],
        )
      }
      res.status(201).json({ ok: true, event, auto_recommendations_created: autoRecs.length })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create vehicle history event.' })
    }
  })

  router.get('/:registration/maintenance', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!regNorm) return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    try {
      const vehicle = await safeGet(db, `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`, [regNorm], null)
      const vehicleId = vehicle ? Number(vehicle.id) : 0
      const rows = await safeAll(
        db,
        `SELECT *
         FROM vehicle_maintenance_recommendations
         WHERE upper(replace(registration, ' ', '')) = ?
            OR (? > 0 AND vehicle_id = ?)
         ORDER BY
           CASE WHEN status = 'open' THEN 0 WHEN status = 'planned' THEN 1 WHEN status = 'completed' THEN 2 ELSE 3 END,
           COALESCE(due_date, created_at) ASC,
           id DESC`,
        [regNorm, vehicleId, vehicleId],
        [],
      )
      res.json({ ok: true, registration: regNorm, recommendations: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load maintenance recommendations.' })
    }
  })

  router.post('/:registration/maintenance', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!regNorm) return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    const body = req.body || {}
    const title = String(body.title || '').trim()
    if (!title) return res.status(400).json({ ok: false, error: 'title is required.' })
    try {
      const vehicle = await safeGet(db, `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`, [regNorm], null)
      const created = await db.run(
        `INSERT INTO vehicle_maintenance_recommendations
         (vehicle_id, registration, recommendation_type, title, description, due_mileage, due_date, priority, status, source, created_from_job_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vehicle ? vehicle.id : null,
          regNorm,
          body.recommendation_type ? String(body.recommendation_type) : 'general',
          title,
          body.description ? String(body.description) : null,
          body.due_mileage != null && body.due_mileage !== '' ? Number(body.due_mileage) : null,
          body.due_date ? String(body.due_date) : null,
          body.priority ? String(body.priority) : 'medium',
          body.status ? String(body.status) : 'open',
          body.source ? String(body.source) : 'manual',
          body.created_from_job_id || null,
        ],
      )
      const recommendation = await db.get(`SELECT * FROM vehicle_maintenance_recommendations WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, recommendation })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create maintenance recommendation.' })
    }
  })

  router.patch('/:registration/maintenance/:id', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    const id = Number(req.params.id || 0)
    if (!regNorm || !id) return res.status(400).json({ ok: false, error: 'Invalid parameters.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM vehicle_maintenance_recommendations WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Recommendation not found.' })
      const next = {
        recommendation_type: body.recommendation_type != null ? String(body.recommendation_type) : row.recommendation_type,
        title: body.title != null ? String(body.title).trim() : row.title,
        description: body.description != null ? (String(body.description).trim() || null) : row.description,
        due_mileage: body.due_mileage != null ? (body.due_mileage === '' ? null : Number(body.due_mileage)) : row.due_mileage,
        due_date: body.due_date != null ? (String(body.due_date).trim() || null) : row.due_date,
        priority: body.priority != null ? String(body.priority) : row.priority,
        status: body.status != null ? String(body.status) : row.status,
        source: body.source != null ? String(body.source) : row.source,
      }
      await db.run(
        `UPDATE vehicle_maintenance_recommendations
         SET recommendation_type = ?, title = ?, description = ?, due_mileage = ?, due_date = ?, priority = ?, status = ?, source = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.recommendation_type, next.title, next.description, next.due_mileage, next.due_date, next.priority, next.status, next.source, id],
      )
      const recommendation = await db.get(`SELECT * FROM vehicle_maintenance_recommendations WHERE id = ?`, [id])
      res.json({ ok: true, recommendation })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update recommendation.' })
    }
  })

  router.get('/:registration/documents', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!regNorm) return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    try {
      const vehicle = await safeGet(db, `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`, [regNorm], null)
      const vehicleId = vehicle ? Number(vehicle.id) : 0
      const rows = await safeAll(
        db,
        `SELECT *
         FROM vehicle_document_records
         WHERE upper(replace(registration, ' ', '')) = ?
            OR (? > 0 AND vehicle_id = ?)
         ORDER BY COALESCE(document_date, created_at) DESC, id DESC`,
        [regNorm, vehicleId, vehicleId],
        [],
      )
      res.json({ ok: true, registration: regNorm, documents: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load vehicle documents.' })
    }
  })

  router.post('/:registration/documents', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!regNorm) return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    const body = req.body || {}
    const title = String(body.title || '').trim()
    if (!title) return res.status(400).json({ ok: false, error: 'title is required.' })
    try {
      const vehicle = await safeGet(db, `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`, [regNorm], null)
      const created = await db.run(
        `INSERT INTO vehicle_document_records
         (vehicle_id, registration, job_id, invoice_id, title, document_type, file_url, notes, document_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vehicle ? vehicle.id : null,
          regNorm,
          body.job_id || null,
          body.invoice_id || null,
          title,
          body.document_type ? String(body.document_type) : 'document',
          body.file_url ? String(body.file_url) : null,
          body.notes ? String(body.notes) : null,
          body.document_date ? String(body.document_date) : null,
        ],
      )
      const document = await db.get(`SELECT * FROM vehicle_document_records WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, document })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create vehicle document record.' })
    }
  })

  router.patch('/:registration/documents/:id', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    const id = Number(req.params.id || 0)
    if (!regNorm || !id) return res.status(400).json({ ok: false, error: 'Invalid parameters.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM vehicle_document_records WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Document record not found.' })
      const next = {
        title: body.title != null ? String(body.title).trim() : row.title,
        document_type: body.document_type != null ? String(body.document_type) : row.document_type,
        file_url: body.file_url != null ? (String(body.file_url).trim() || null) : row.file_url,
        notes: body.notes != null ? (String(body.notes).trim() || null) : row.notes,
        document_date: body.document_date != null ? (String(body.document_date).trim() || null) : row.document_date,
      }
      await db.run(
        `UPDATE vehicle_document_records
         SET title = ?, document_type = ?, file_url = ?, notes = ?, document_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.title, next.document_type, next.file_url, next.notes, next.document_date, id],
      )
      const document = await db.get(`SELECT * FROM vehicle_document_records WHERE id = ?`, [id])
      res.json({ ok: true, document })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update document record.' })
    }
  })

  router.get('/:registration/overview', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!regNorm) return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    try {
      const vehicle = await safeGet(
        db,
        `SELECT * FROM vehicles WHERE upper(replace(registration, ' ', '')) = ? LIMIT 1`,
        [regNorm],
        null,
      )
      const vehicleId = vehicle ? Number(vehicle.id) : 0

      const jobs = await safeAll(
        db,
        `SELECT j.*, c.first_name AS customer_first_name, c.surname AS customer_surname
         FROM jobs j
         LEFT JOIN vehicles v ON v.id = j.vehicle_id
         LEFT JOIN customers c ON c.id = j.customer_id
         WHERE (? > 0 AND j.vehicle_id = ?)
            OR upper(replace(coalesce(v.registration, ''), ' ', '')) = ?
         ORDER BY COALESCE(j.booked_start, CONCAT(j.requested_date, ' 00:00:00')) DESC, j.id DESC
         LIMIT 200`,
        [vehicleId, vehicleId, regNorm],
        [],
      )
      const jobIds = (jobs || []).map((j) => Number(j.id)).filter(Boolean)
      const inPlaceholders = jobIds.length ? jobIds.map(() => '?').join(',') : '0'

      const quotes = await safeAll(
        db,
        `SELECT q.*
         FROM quotes q
         LEFT JOIN vehicles v ON v.id = q.vehicle_id
         WHERE (? > 0 AND q.vehicle_id = ?)
            OR upper(replace(coalesce(v.registration, ''), ' ', '')) = ?
            OR (q.job_id IN (${inPlaceholders}))
         ORDER BY q.updated_at DESC, q.id DESC
         LIMIT 300`,
        [vehicleId, vehicleId, regNorm, ...jobIds],
        [],
      )

      const quoteIds = (quotes || []).map((q) => Number(q.id)).filter(Boolean)
      const quoteIn = quoteIds.length ? quoteIds.map(() => '?').join(',') : '0'

      const invoices = await safeAll(
        db,
        `SELECT i.*
         FROM invoices i
         WHERE (? > 0 AND i.vehicle_id = ?)
            OR i.job_id IN (${inPlaceholders})
            OR i.quote_id IN (${quoteIn})
         ORDER BY i.updated_at DESC, i.id DESC
         LIMIT 300`,
        [vehicleId, vehicleId, ...jobIds, ...quoteIds],
        [],
      )

      const events = await safeAll(
        db,
        `SELECT * FROM vehicle_service_events
         WHERE upper(replace(registration, ' ', '')) = ?
            OR (? > 0 AND vehicle_id = ?)
         ORDER BY COALESCE(event_date, created_at) DESC, id DESC`,
        [regNorm, vehicleId, vehicleId],
        [],
      )

      const maintenance = await safeAll(
        db,
        `SELECT * FROM vehicle_maintenance_recommendations
         WHERE upper(replace(registration, ' ', '')) = ?
            OR (? > 0 AND vehicle_id = ?)
         ORDER BY
           CASE WHEN status = 'open' THEN 0 WHEN status = 'planned' THEN 1 WHEN status = 'completed' THEN 2 ELSE 3 END,
           COALESCE(due_date, created_at) ASC`,
        [regNorm, vehicleId, vehicleId],
        [],
      )

      const documents = await safeAll(
        db,
        `SELECT * FROM vehicle_document_records
         WHERE upper(replace(registration, ' ', '')) = ?
            OR (? > 0 AND vehicle_id = ?)
         ORDER BY COALESCE(document_date, created_at) DESC, id DESC`,
        [regNorm, vehicleId, vehicleId],
        [],
      )

      const invoiceIds = (invoices || []).map((x) => Number(x.id)).filter(Boolean)
      const invoiceIn = invoiceIds.length ? invoiceIds.map(() => '?').join(',') : '0'
      const paymentsSummary = await safeGet(
        db,
        `SELECT COALESCE(SUM(amount), 0) AS payments_total, COUNT(*) AS payments_count
         FROM invoice_payments
         WHERE invoice_id IN (${invoiceIn})
           AND status NOT IN ('failed', 'cancelled')`,
        [...invoiceIds],
        { payments_total: 0, payments_count: 0 },
      )

      res.json({
        ok: true,
        registration: regNorm,
        vehicle: vehicle || null,
        jobs: jobs || [],
        quotes: quotes || [],
        invoices: invoices || [],
        service_events: events || [],
        maintenance_recommendations: maintenance || [],
        document_records: documents || [],
        payment_summary: {
          payments_total: Number((paymentsSummary && paymentsSummary.payments_total) || 0),
          payments_count: Number((paymentsSummary && paymentsSummary.payments_count) || 0),
        },
      })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load vehicle overview.' })
    }
  })

  router.get('/:registration', async (req, res) => {
    const regNorm = normaliseRegistration(req.params.registration)
    if (!isLikelyUkRegistration(regNorm)) {
      return res.status(400).json({ ok: false, error: 'Invalid registration.' })
    }

    const vehicle = await db.get(
      `
      SELECT *
      FROM vehicles
      WHERE upper(replace(registration, ' ', '')) = ?
      LIMIT 1
    `,
      [regNorm],
    )

    if (!vehicle) {
      return res.status(404).json({ ok: false, error: 'Vehicle not found' })
    }

    res.json({ ok: true, vehicle })
  })

  return router
}

module.exports = {
  createVehiclesRouter,
}
