'use strict'

const express = require('express')
const { toOperationalUpper } = require('../db/utils')

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toDecimal(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function createServicesRouter({ db }) {
  const router = express.Router()

  router.get('/service-templates', async (req, res) => {
    try {
      const includeInactive =
        String(req.query.include_inactive || '').trim().toLowerCase() === 'true'
      const rows = await db.all(
        `
        SELECT
          id, name, category, fuel_type,
          default_duration_minutes, duration_confidence,
          fixed_price, requires_quote_first, is_mot, active,
          description
        FROM service_templates
        ${includeInactive ? '' : 'WHERE active = 1'}
        ORDER BY
          CASE WHEN is_mot = 1 THEN 0 ELSE 1 END,
          category ASC,
          name ASC
      `,
      )

      res.json({ ok: true, service_templates: rows || [] })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not load service templates.' })
    }
  })

  router.post('/service-templates', async (req, res) => {
    const body = req.body || {}
    const name = toOperationalUpper(body.name)
    if (!name) return res.status(400).json({ ok: false, error: 'name is required.' })
    const category = body.category != null ? toOperationalUpper(body.category) || null : null
    const fuelType = body.fuel_type != null ? toOperationalUpper(body.fuel_type) || null : null
    const description =
      body.description != null ? toOperationalUpper(body.description) || null : null
    const duration = toInt(body.default_duration_minutes, 60)
    const fixedPrice =
      body.fixed_price == null || body.fixed_price === ''
        ? null
        : toDecimal(body.fixed_price, 0)
    const requiresQuote = body.requires_quote_first ? 1 : 0
    const isMot = body.is_mot ? 1 : 0
    const active = body.active === 0 || body.active === false ? 0 : 1
    try {
      const created = await db.run(
        `INSERT INTO service_templates
        (name, category, fuel_type, default_duration_minutes, duration_confidence, fixed_price, requires_quote_first, is_mot, active, description)
         VALUES (?, ?, ?, ?, 'medium', ?, ?, ?, ?, ?)`,
        [name, category, fuelType, duration, fixedPrice, requiresQuote, isMot, active, description],
      )
      const row = await db.get(`SELECT * FROM service_templates WHERE id = ?`, [
        created.lastInsertId,
      ])
      res.status(201).json({ ok: true, service_template: row })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to create service template.' })
    }
  })

  router.patch('/service-templates/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid service template id.' })
    const body = req.body || {}

    try {
      const row = await db.get(`SELECT * FROM service_templates WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Service template not found.' })

      const next = {
        name: body.name != null ? toOperationalUpper(body.name) : row.name,
        category: body.category != null ? toOperationalUpper(body.category) || null : row.category,
        fuel_type: body.fuel_type != null ? toOperationalUpper(body.fuel_type) || null : row.fuel_type,
        default_duration_minutes:
          body.default_duration_minutes != null
            ? toInt(body.default_duration_minutes, 0)
            : row.default_duration_minutes,
        fixed_price: body.fixed_price != null ? toDecimal(body.fixed_price, 0) : row.fixed_price,
        requires_quote_first:
          body.requires_quote_first != null
            ? body.requires_quote_first === 0 || body.requires_quote_first === false
              ? 0
              : 1
            : row.requires_quote_first,
        is_mot:
          body.is_mot != null
            ? body.is_mot === 0 || body.is_mot === false
              ? 0
              : 1
            : row.is_mot,
        description:
          body.description != null
            ? toOperationalUpper(body.description) || null
            : row.description,
        active:
          body.active != null
            ? body.active === 0 || body.active === false
              ? 0
              : 1
            : row.active,
      }

      await db.run(
        `UPDATE service_templates
         SET name = ?, category = ?, fuel_type = ?, default_duration_minutes = ?,
             fixed_price = ?, requires_quote_first = ?, is_mot = ?, description = ?, active = ?
         WHERE id = ?`,
        [
          next.name,
          next.category,
          next.fuel_type,
          next.default_duration_minutes,
          next.fixed_price,
          next.requires_quote_first,
          next.is_mot,
          next.description,
          next.active,
          id,
        ],
      )

      const updated = await db.get(`SELECT * FROM service_templates WHERE id = ?`, [id])
      res.json({ ok: true, service_template: updated })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to update service template.' })
    }
  })

  return router
}

module.exports = {
  createServicesRouter,
}
