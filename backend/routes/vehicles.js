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
