'use strict'

const express = require('express')
const { normaliseOperationalText } = require('../db/utils')

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toDecimal(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round2(value) {
  return Math.round(toDecimal(value, 0) * 100) / 100
}

function pad4(n) {
  return String(n).padStart(4, '0')
}

async function generateInvoiceNumber(tx) {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`
  const last = await tx.get(
    `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`],
  )
  let next = 1
  if (last && last.invoice_number) {
    const m = String(last.invoice_number).match(/INV-\d{4}-(\d{4})$/)
    if (m && m[1]) next = Number(m[1]) + 1
  }
  return `${prefix}${pad4(next)}`
}

function createInvoicesRouter({ db }) {
  const router = express.Router()

  router.post('/jobs/:id/invoice', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })

    const forceNew = String((req.body || {}).force_new || '').toLowerCase() === 'true' || (req.body || {}).force_new === 1

    try {
      const out = await db.transaction(async (tx) => {
        const existing = await tx.get(`SELECT * FROM invoices WHERE job_id = ? ORDER BY id DESC LIMIT 1`, [jobId])
        if (existing && !forceNew) {
          return { invoice: existing, reused: true }
        }

        const job = await tx.get(`SELECT * FROM jobs WHERE id = ?`, [jobId])
        if (!job) {
          const err = new Error('Job not found.')
          err.status = 404
          throw err
        }

        const quote = await tx.get(
          `SELECT * FROM quotes WHERE job_id = ? AND status = 'accepted' ORDER BY updated_at DESC, id DESC LIMIT 1`,
          [jobId],
        )

        const invoiceNumber = await generateInvoiceNumber(tx)
        const created = await tx.run(
          `INSERT INTO invoices (
            job_id, quote_id, customer_id, vehicle_id, invoice_number, status,
            subtotal_ex_vat, vat_total, total_inc_vat, notes
          ) VALUES (?, ?, ?, ?, ?, 'draft', 0, 0, 0, NULL)`,
          [job.id, quote ? quote.id : null, job.customer_id || null, job.vehicle_id || null, invoiceNumber],
        )

        const invoiceId = created.lastInsertId

        if (quote && quote.id) {
          const quoteItems = await tx.all(
            `SELECT * FROM quote_items WHERE quote_id = ? AND selected_for_quote = 1 ORDER BY sort_order ASC, id ASC`,
            [quote.id],
          )

          let subtotal = 0
          let vat = 0
          for (const item of quoteItems || []) {
            const qty = toDecimal(item.quantity, 1)
            const unit = toDecimal(item.unit_sell, 0)
            const rate = toDecimal(item.vat_rate, 0.2)
            const lineEx = round2(qty * unit)
            const lineInc = round2(lineEx * (1 + rate))
            subtotal += lineEx
            vat += round2(lineInc - lineEx)
            await tx.run(
              `INSERT INTO invoice_items (
                invoice_id, item_type, description, quantity, unit_price_ex_vat, vat_rate, total_ex_vat, total_inc_vat
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                invoiceId,
                item.item_type || 'other',
                normaliseOperationalText(item.description || 'ITEM'),
                qty,
                unit,
                rate,
                lineEx,
                lineInc,
              ],
            )
          }

          await tx.run(
            `UPDATE invoices
             SET subtotal_ex_vat = ?, vat_total = ?, total_inc_vat = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [round2(subtotal), round2(vat), round2(subtotal + vat), invoiceId],
          )
        }

        const invoice = await tx.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
        return { invoice, reused: false }
      })

      res.status(out.reused ? 200 : 201).json({ ok: true, ...out })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to create invoice.' })
    }
  })

  router.get('/jobs/:id/invoices', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    try {
      const rows = await db.all(`SELECT * FROM invoices WHERE job_id = ? ORDER BY id DESC`, [jobId])
      res.json({ ok: true, invoices: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load invoices.' })
    }
  })

  router.get('/invoices/:id', async (req, res) => {
    const invoiceId = toInt(req.params.id, 0)
    if (!invoiceId) return res.status(400).json({ ok: false, error: 'Invalid invoice id.' })
    try {
      const invoice = await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
      if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found.' })
      const items = await db.all(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC`, [invoiceId])
      res.json({ ok: true, invoice, items: items || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load invoice.' })
    }
  })

  router.patch('/invoices/:id', async (req, res) => {
    const invoiceId = toInt(req.params.id, 0)
    if (!invoiceId) return res.status(400).json({ ok: false, error: 'Invalid invoice id.' })
    const body = req.body || {}
    const status = body.status != null ? String(body.status).trim().toLowerCase() : null
    const notes = body.notes != null ? String(body.notes).trim() : null

    try {
      await db.run(
        `UPDATE invoices
         SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, notes, invoiceId],
      )
      const invoice = await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
      res.json({ ok: true, invoice })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update invoice.' })
    }
  })

  return router
}

module.exports = {
  createInvoicesRouter,
}
