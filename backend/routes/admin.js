'use strict'

const express = require('express')
const { toOperationalUpper, cleanPhone } = require('../db/utils')
const { logActivity } = require('../lib/activity')

function toDecimal(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function createAdminRouter({ db }) {
  const router = express.Router()

  router.get('/admin/company-settings', async (req, res) => {
    try {
      let row = await db.get(`SELECT * FROM company_settings ORDER BY id ASC LIMIT 1`)
      if (!row) {
        const created = await db.run(
          `INSERT INTO company_settings (theme_default) VALUES ('dark')`,
        )
        row = await db.get(`SELECT * FROM company_settings WHERE id = ?`, [created.lastInsertId])
      }
      res.json({ ok: true, settings: row })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load company settings.' })
    }
  })

  router.patch('/admin/company-settings', async (req, res) => {
    const body = req.body || {}
    try {
      let row = await db.get(`SELECT * FROM company_settings ORDER BY id ASC LIMIT 1`)
      if (!row) {
        const created = await db.run(
          `INSERT INTO company_settings (theme_default) VALUES ('dark')`,
        )
        row = await db.get(`SELECT * FROM company_settings WHERE id = ?`, [created.lastInsertId])
      }

      const patch = {
        company_name: body.company_name != null ? toOperationalUpper(body.company_name) : row.company_name,
        trading_name: body.trading_name != null ? toOperationalUpper(body.trading_name) : row.trading_name,
        phone: body.phone != null ? cleanPhone(body.phone) : row.phone,
        email: body.email != null ? String(body.email).trim() : row.email,
        address: body.address != null ? toOperationalUpper(body.address) : row.address,
        vat_number: body.vat_number != null ? toOperationalUpper(body.vat_number) : row.vat_number,
        default_vat_rate: body.default_vat_rate != null ? toDecimal(body.default_vat_rate, 0.2) : row.default_vat_rate,
        quote_prefix: body.quote_prefix != null ? toOperationalUpper(body.quote_prefix) : row.quote_prefix,
        invoice_prefix: body.invoice_prefix != null ? toOperationalUpper(body.invoice_prefix) : row.invoice_prefix,
        theme_default:
          body.theme_default === 'light' || body.theme_default === 'dark'
            ? body.theme_default
            : row.theme_default,
      }

      await db.run(
        `UPDATE company_settings
         SET company_name = ?, trading_name = ?, phone = ?, email = ?, address = ?, vat_number = ?,
             default_vat_rate = ?, quote_prefix = ?, invoice_prefix = ?, theme_default = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          patch.company_name,
          patch.trading_name,
          patch.phone,
          patch.email,
          patch.address,
          patch.vat_number,
          patch.default_vat_rate,
          patch.quote_prefix,
          patch.invoice_prefix,
          patch.theme_default,
          row.id,
        ],
      )

      const updated = await db.get(`SELECT * FROM company_settings WHERE id = ?`, [row.id])
      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'settings',
        entityId: row.id,
        action: 'settings_changed',
        summary: 'COMPANY SETTINGS UPDATED',
      })
      res.json({ ok: true, settings: updated })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to save company settings.' })
    }
  })

  router.get('/admin/technicians', async (req, res) => {
    try {
      const rows = await db.all(
        `SELECT id, name, capabilities, active, created_at, updated_at
         FROM technicians
         ORDER BY active DESC, name ASC`,
      )
      res.json({ ok: true, technicians: rows || [] })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load technicians.' })
    }
  })

  router.post('/admin/technicians', async (req, res) => {
    const body = req.body || {}
    const name = toOperationalUpper(body.name)
    if (!name) return res.status(400).json({ ok: false, error: 'Technician name is required.' })

    const capabilities =
      body.capabilities != null ? toOperationalUpper(body.capabilities) || null : null
    const active = body.active === 0 || body.active === false ? 0 : 1

    try {
      const created = await db.run(
        `INSERT INTO technicians (name, capabilities, active) VALUES (?, ?, ?)`,
        [name, capabilities, active],
      )
      const row = await db.get(`SELECT * FROM technicians WHERE id = ?`, [created.lastInsertId])
      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'technician',
        entityId: row.id,
        action: 'technician_created',
        summary: `TECHNICIAN CREATED: ${row.name}`,
      })
      res.status(201).json({ ok: true, technician: row })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to create technician.' })
    }
  })

  router.patch('/admin/technicians/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid technician id.' })

    const body = req.body || {}

    try {
      const row = await db.get(`SELECT * FROM technicians WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Technician not found.' })

      const next = {
        name: body.name != null ? toOperationalUpper(body.name) : row.name,
        capabilities:
          body.capabilities != null ? toOperationalUpper(body.capabilities) || null : row.capabilities,
        active:
          body.active != null ? (body.active === 0 || body.active === false ? 0 : 1) : row.active,
      }

      await db.run(
        `UPDATE technicians
         SET name = ?, capabilities = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.name, next.capabilities, next.active, id],
      )
      const updated = await db.get(`SELECT * FROM technicians WHERE id = ?`, [id])
      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'technician',
        entityId: id,
        action: 'technician_updated',
        summary: `TECHNICIAN UPDATED: ${updated.name}`,
      })
      res.json({ ok: true, technician: updated })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to update technician.' })
    }
  })

  router.get('/admin/integrations-status', async (_req, res) => {
    try {
      const configured = (value) => Boolean(String(value || '').trim())
      res.json({
        ok: true,
        integrations: {
          n8n_vehicle_lookup: configured(process.env.N8N_CHECK_VEHICLE_WEBHOOK_URL),
          sms_provider: false,
          stripe: false,
          dojo: false,
        },
        note: 'Secrets are never returned by this endpoint.',
      })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load integration status.' })
    }
  })

  router.get('/admin/job-statuses', async (_req, res) => {
    try {
      const rows = await db.all(
        `SELECT id, code, label, colour, sort_order, appears_on_calendar, calendar_active, active, updated_at
         FROM job_statuses
         ORDER BY sort_order ASC, id ASC`,
      )
      res.json({ ok: true, statuses: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load job statuses.' })
    }
  })

  router.post('/admin/job-statuses', async (req, res) => {
    const body = req.body || {}
    const code = String(body.code || '').trim().toLowerCase()
    const label = toOperationalUpper(body.label)
    if (!code || !label) return res.status(400).json({ ok: false, error: 'code and label are required.' })
    try {
      const created = await db.run(
        `INSERT INTO job_statuses (code, label, colour, sort_order, appears_on_calendar, calendar_active, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          label,
          String(body.colour || 'grey').trim().toLowerCase(),
          toInt(body.sort_order, 999),
          body.appears_on_calendar === 0 || body.appears_on_calendar === false ? 0 : 1,
          body.calendar_active === 1 || body.calendar_active === true ? 1 : 0,
          body.active === 0 || body.active === false ? 0 : 1,
        ],
      )
      const row = await db.get(`SELECT * FROM job_statuses WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, status: row })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.code === 'ER_DUP_ENTRY' ? 'Status code already exists.' : 'Failed to create status.' })
    }
  })

  router.patch('/admin/job-statuses/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid status id.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM job_statuses WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Status not found.' })
      const next = {
        label: body.label != null ? toOperationalUpper(body.label) : row.label,
        colour: body.colour != null ? String(body.colour).trim().toLowerCase() || 'grey' : row.colour,
        sort_order: body.sort_order != null ? toInt(body.sort_order, row.sort_order) : row.sort_order,
        appears_on_calendar: body.appears_on_calendar != null ? (body.appears_on_calendar ? 1 : 0) : row.appears_on_calendar,
        calendar_active: body.calendar_active != null ? (body.calendar_active ? 1 : 0) : row.calendar_active,
        active: body.active != null ? (body.active ? 1 : 0) : row.active,
      }
      await db.run(
        `UPDATE job_statuses
         SET label = ?, colour = ?, sort_order = ?, appears_on_calendar = ?, calendar_active = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.label, next.colour, next.sort_order, next.appears_on_calendar, next.calendar_active, next.active, id],
      )
      const updated = await db.get(`SELECT * FROM job_statuses WHERE id = ?`, [id])
      res.json({ ok: true, status: updated })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update status.' })
    }
  })

  return router
}

module.exports = {
  createAdminRouter,
}
