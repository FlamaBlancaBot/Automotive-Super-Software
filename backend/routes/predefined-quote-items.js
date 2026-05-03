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

function createPredefinedQuoteItemsRouter({ db }) {
  const router = express.Router()

  // Predefined quote items are a foundation for fast quoting.
  // Admin management UI will come later; for now we just expose the active list.
  router.get('/predefined-quote-items', async (req, res) => {
    try {
      const rows = await db.all(
        `
        SELECT
          id,
          item_type,
          name,
          description,
          default_unit,
          default_cost_ex_vat,
          default_sell_ex_vat,
          default_markup_percent,
          vat_rate,
          active,
          updated_at
        FROM predefined_quote_items
        WHERE active = 1
        ORDER BY item_type ASC, name ASC
      `,
      )
      res.json({ ok: true, items: rows })
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: 'Failed to load predefined quote items.',
      })
    }
  })

  router.post('/predefined-quote-items', async (req, res) => {
    const body = req.body || {}
    const itemType = String(body.item_type || '').trim().toLowerCase()
    const name = toOperationalUpper(body.name)
    if (!itemType || !name) {
      return res.status(400).json({ ok: false, error: 'item_type and name are required.' })
    }

    try {
      const created = await db.run(
        `INSERT INTO predefined_quote_items (
          item_type, name, description, default_unit, default_cost_ex_vat, default_sell_ex_vat,
          default_markup_percent, vat_rate, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemType,
          name,
          body.description ? toOperationalUpper(body.description) : null,
          body.default_unit ? String(body.default_unit).trim() : null,
          body.default_cost_ex_vat != null ? toDecimal(body.default_cost_ex_vat, 0) : null,
          body.default_sell_ex_vat != null ? toDecimal(body.default_sell_ex_vat, 0) : null,
          body.default_markup_percent != null ? toDecimal(body.default_markup_percent, 0) : null,
          body.vat_rate != null ? toDecimal(body.vat_rate, 0.2) : 0.2,
          body.active === 0 || body.active === false ? 0 : 1,
        ],
      )

      const row = await db.get(`SELECT * FROM predefined_quote_items WHERE id = ?`, [
        created.lastInsertId,
      ])
      res.status(201).json({ ok: true, item: row })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to create predefined quote item.' })
    }
  })

  router.patch('/predefined-quote-items/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid id.' })
    const body = req.body || {}

    try {
      const row = await db.get(`SELECT * FROM predefined_quote_items WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Item not found.' })

      const next = {
        item_type: body.item_type != null ? String(body.item_type).trim().toLowerCase() : row.item_type,
        name: body.name != null ? toOperationalUpper(body.name) : row.name,
        description: body.description != null ? toOperationalUpper(body.description) : row.description,
        default_unit: body.default_unit != null ? String(body.default_unit).trim() : row.default_unit,
        default_cost_ex_vat:
          body.default_cost_ex_vat != null ? toDecimal(body.default_cost_ex_vat, 0) : row.default_cost_ex_vat,
        default_sell_ex_vat:
          body.default_sell_ex_vat != null ? toDecimal(body.default_sell_ex_vat, 0) : row.default_sell_ex_vat,
        default_markup_percent:
          body.default_markup_percent != null ? toDecimal(body.default_markup_percent, 0) : row.default_markup_percent,
        vat_rate: body.vat_rate != null ? toDecimal(body.vat_rate, 0.2) : row.vat_rate,
        active: body.active != null ? (body.active === 0 || body.active === false ? 0 : 1) : row.active,
      }

      await db.run(
        `UPDATE predefined_quote_items
         SET item_type = ?, name = ?, description = ?, default_unit = ?,
             default_cost_ex_vat = ?, default_sell_ex_vat = ?, default_markup_percent = ?,
             vat_rate = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          next.item_type,
          next.name,
          next.description,
          next.default_unit,
          next.default_cost_ex_vat,
          next.default_sell_ex_vat,
          next.default_markup_percent,
          next.vat_rate,
          next.active,
          id,
        ],
      )
      const updated = await db.get(`SELECT * FROM predefined_quote_items WHERE id = ?`, [id])
      res.json({ ok: true, item: updated })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to update predefined quote item.' })
    }
  })

  return router
}

module.exports = {
  createPredefinedQuoteItemsRouter,
}
