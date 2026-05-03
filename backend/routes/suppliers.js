'use strict'

const express = require('express')
const { toOperationalUpper } = require('../db/utils')

function createSuppliersRouter({ db }) {
  const router = express.Router()

  router.get('/suppliers', async (req, res) => {
    const usage = String(req.query.usage || '').trim().toLowerCase()
    const usageColumn =
      usage === 'quotes'
        ? 'usage_quotes'
        : usage === 'parts'
          ? 'usage_parts'
          : usage === 'mot'
            ? 'usage_mot'
            : usage === 'diagnostics'
              ? 'usage_diagnostics'
              : usage === 'general'
                ? 'usage_general'
                : null
    try {
      const rows = await db.all(
        `
        SELECT id, name, contact_name, phone, email, website, notes,
               usage_quotes, usage_parts, usage_mot, usage_diagnostics, usage_general,
               active, created_at, updated_at
        FROM suppliers
        WHERE active = 1
          ${usageColumn ? `AND ${usageColumn} = 1` : ''}
        ORDER BY name ASC
      `,
      )
      res.json({ ok: true, suppliers: rows })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load suppliers.' })
    }
  })

  router.post('/suppliers', async (req, res) => {
    const body = req.body || {}
    const name = toOperationalUpper(body.name)
    if (!name) return res.status(400).json({ ok: false, error: 'Supplier name is required.' })

    const contactName = body.contact_name ? toOperationalUpper(body.contact_name) : null
    const phone = body.phone ? String(body.phone).trim() : null
    const email = body.email ? String(body.email).trim() : null
    const website = body.website ? String(body.website).trim() : null
    const notes = body.notes ? toOperationalUpper(body.notes) : null
    const usageQuotes = body.usage_quotes === 0 || body.usage_quotes === false ? 0 : 1
    const usageParts = body.usage_parts === 0 || body.usage_parts === false ? 0 : 1
    const usageMot = body.usage_mot === 0 || body.usage_mot === false ? 0 : 1
    const usageDiagnostics = body.usage_diagnostics === 0 || body.usage_diagnostics === false ? 0 : 1
    const usageGeneral = body.usage_general === 0 || body.usage_general === false ? 0 : 1

    try {
      const created = await db.run(
        `INSERT INTO suppliers (
          name, contact_name, phone, email, website, notes,
          usage_quotes, usage_parts, usage_mot, usage_diagnostics, usage_general, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [name, contactName, phone, email, website, notes, usageQuotes, usageParts, usageMot, usageDiagnostics, usageGeneral],
      )

      const supplier = await db.get(
        `SELECT id, name, contact_name, phone, email, website, notes,
                usage_quotes, usage_parts, usage_mot, usage_diagnostics, usage_general,
                active, created_at, updated_at
         FROM suppliers
         WHERE id = ?`,
        [created.lastInsertId],
      )

      res.status(201).json({ ok: true, supplier })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to create supplier.' })
    }
  })

  router.patch('/suppliers/:id', async (req, res) => {
    const id = Number(req.params.id || 0)
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid supplier id.' })
    }

    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM suppliers WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Supplier not found.' })

      const next = {
        name: body.name != null ? toOperationalUpper(body.name) : row.name,
        contact_name:
          body.contact_name != null ? toOperationalUpper(body.contact_name) || null : row.contact_name,
        phone: body.phone != null ? String(body.phone).trim() || null : row.phone,
        email: body.email != null ? String(body.email).trim() || null : row.email,
        website: body.website != null ? String(body.website).trim() || null : row.website,
        notes: body.notes != null ? toOperationalUpper(body.notes) || null : row.notes,
        usage_quotes:
          body.usage_quotes != null ? (body.usage_quotes === 0 || body.usage_quotes === false ? 0 : 1) : row.usage_quotes,
        usage_parts:
          body.usage_parts != null ? (body.usage_parts === 0 || body.usage_parts === false ? 0 : 1) : row.usage_parts,
        usage_mot:
          body.usage_mot != null ? (body.usage_mot === 0 || body.usage_mot === false ? 0 : 1) : row.usage_mot,
        usage_diagnostics:
          body.usage_diagnostics != null ? (body.usage_diagnostics === 0 || body.usage_diagnostics === false ? 0 : 1) : row.usage_diagnostics,
        usage_general:
          body.usage_general != null ? (body.usage_general === 0 || body.usage_general === false ? 0 : 1) : row.usage_general,
        active: body.active != null ? (body.active === 0 || body.active === false ? 0 : 1) : row.active,
      }

      await db.run(
        `UPDATE suppliers
         SET name = ?, contact_name = ?, phone = ?, email = ?, website = ?, notes = ?,
             usage_quotes = ?, usage_parts = ?, usage_mot = ?, usage_diagnostics = ?, usage_general = ?,
             active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          next.name,
          next.contact_name,
          next.phone,
          next.email,
          next.website,
          next.notes,
          next.usage_quotes,
          next.usage_parts,
          next.usage_mot,
          next.usage_diagnostics,
          next.usage_general,
          next.active,
          id,
        ],
      )

      const updated = await db.get(
        `SELECT id, name, contact_name, phone, email, website, notes,
                usage_quotes, usage_parts, usage_mot, usage_diagnostics, usage_general,
                active, created_at, updated_at
         FROM suppliers
         WHERE id = ?`,
        [id],
      )
      res.json({ ok: true, supplier: updated })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to update supplier.' })
    }
  })

  return router
}

module.exports = {
  createSuppliersRouter,
}
