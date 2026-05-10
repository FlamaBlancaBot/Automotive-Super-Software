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

const PAYMENT_METHODS = new Set(['cash', 'card_machine', 'bank_transfer', 'online', 'cheque', 'other'])
const PAYMENT_TYPES = new Set(['deposit', 'partial', 'final', 'refund', 'credit'])
const PAYMENT_STATUSES = new Set(['recorded', 'pending', 'cleared', 'failed', 'refunded', 'cancelled'])
const INVOICE_PAYMENT_STATUSES = new Set(['unpaid', 'deposit_paid', 'partially_paid', 'paid', 'overdue', 'refunded'])

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

async function recalculateInvoicePaymentStatus(db, invoiceId) {
  const invoice = await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
  if (!invoice) return null

  const rows = await db.all(
    `
    SELECT amount, payment_type, status
    FROM invoice_payments
    WHERE invoice_id = ?
  `,
    [invoiceId],
  ).catch(() => [])

  let paidTotal = 0
  let refundTotal = 0
  let hasDeposit = false
  for (const r of rows || []) {
    const status = String(r.status || '').toLowerCase()
    if (status === 'failed' || status === 'cancelled') continue
    const amount = round2(toDecimal(r.amount, 0))
    const type = String(r.payment_type || '').toLowerCase()
    if (type === 'refund' || type === 'credit' || status === 'refunded') {
      refundTotal += Math.abs(amount)
    } else {
      paidTotal += Math.abs(amount)
      if (type === 'deposit') hasDeposit = true
    }
  }

  const total = round2(toDecimal(invoice.total_inc_vat, 0))
  const netPaid = round2(paidTotal - refundTotal)
  const amountPaid = Math.max(0, netPaid)
  const balanceDue = round2(total - amountPaid)

  let paymentStatus = 'unpaid'
  if (amountPaid <= 0 && refundTotal > 0) paymentStatus = 'refunded'
  else if (amountPaid <= 0) paymentStatus = 'unpaid'
  else if (balanceDue <= 0) paymentStatus = 'paid'
  else if (hasDeposit) paymentStatus = 'deposit_paid'
  else paymentStatus = 'partially_paid'

  if (balanceDue > 0 && invoice.due_date) {
    const due = new Date(invoice.due_date).getTime()
    if (!Number.isNaN(due) && due < Date.now()) paymentStatus = 'overdue'
  }

  await db.run(
    `UPDATE invoices
     SET amount_paid = ?, balance_due = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [round2(amountPaid), round2(Math.max(0, balanceDue)), paymentStatus, invoiceId],
  )

  return await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
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
          `SELECT * FROM quotes WHERE job_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1`,
          [jobId],
        )

        const invoiceNumber = await generateInvoiceNumber(tx)
        const created = await tx.run(
          `INSERT INTO invoices (
            job_id, quote_id, customer_id, vehicle_id, invoice_number, status,
            subtotal_ex_vat, vat_total, total_inc_vat, amount_paid, balance_due, payment_status, notes
          ) VALUES (?, ?, ?, ?, ?, 'draft', 0, 0, 0, 0, 0, 'unpaid', NULL)`,
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
             SET subtotal_ex_vat = ?, vat_total = ?, total_inc_vat = ?, balance_due = ?, payment_status = 'unpaid', updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [round2(subtotal), round2(vat), round2(subtotal + vat), round2(subtotal + vat), invoiceId],
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
      const payments = await db.all(`SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY COALESCE(paid_at, created_at) DESC, id DESC`, [invoiceId]).catch(() => [])
      res.json({ ok: true, invoice, items: items || [], payments: payments || [] })
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
    const dueDate = body.due_date != null ? (String(body.due_date).trim() || null) : null

    try {
      await db.run(
        `UPDATE invoices
         SET status = COALESCE(?, status), notes = COALESCE(?, notes), due_date = COALESCE(?, due_date), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status, notes, dueDate, invoiceId],
      )
      const invoice = await recalculateInvoicePaymentStatus(db, invoiceId) || await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
      res.json({ ok: true, invoice })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update invoice.' })
    }
  })

  router.get('/invoices/:id/payments', async (req, res) => {
    const invoiceId = toInt(req.params.id, 0)
    if (!invoiceId) return res.status(400).json({ ok: false, error: 'Invalid invoice id.' })
    try {
      const invoice = await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
      if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found.' })
      const rows = await db.all(
        `SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY COALESCE(paid_at, created_at) DESC, id DESC`,
        [invoiceId],
      )
      res.json({ ok: true, payments: rows || [], invoice })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load invoice payments.' })
    }
  })

  router.post('/invoices/:id/payments', async (req, res) => {
    const invoiceId = toInt(req.params.id, 0)
    if (!invoiceId) return res.status(400).json({ ok: false, error: 'Invalid invoice id.' })
    const body = req.body || {}
    const amountRaw = toDecimal(body.amount, NaN)
    const paymentType = String(body.payment_type || 'partial').trim().toLowerCase()
    const paymentMethod = String(body.payment_method || 'other').trim().toLowerCase()
    const paymentStatus = String(body.status || 'recorded').trim().toLowerCase()
    const paymentReference = body.payment_reference != null ? String(body.payment_reference).trim() || null : null
    const notes = body.notes != null ? String(body.notes).trim() || null : null
    const paidAt = body.paid_at ? String(body.paid_at) : null

    if (!PAYMENT_TYPES.has(paymentType)) return res.status(400).json({ ok: false, error: 'Invalid payment_type.' })
    if (!PAYMENT_METHODS.has(paymentMethod)) return res.status(400).json({ ok: false, error: 'Invalid payment_method.' })
    if (!PAYMENT_STATUSES.has(paymentStatus)) return res.status(400).json({ ok: false, error: 'Invalid payment status.' })
    if (!Number.isFinite(amountRaw)) return res.status(400).json({ ok: false, error: 'Amount must be numeric.' })
    if ((paymentType === 'refund' || paymentType === 'credit') ? amountRaw >= 0 : amountRaw <= 0) {
      return res.status(400).json({ ok: false, error: 'Amount sign is invalid for this payment type.' })
    }

    try {
      const invoice = await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId])
      if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found.' })
      const created = await db.run(
        `INSERT INTO invoice_payments
         (invoice_id, customer_id, job_id, quote_id, amount, payment_method, payment_type, payment_reference, notes, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceId,
          invoice.customer_id || null,
          invoice.job_id || null,
          invoice.quote_id || null,
          round2(amountRaw),
          paymentMethod,
          paymentType,
          paymentReference,
          notes,
          paymentStatus,
          paidAt,
        ],
      )
      const payment = await db.get(`SELECT * FROM invoice_payments WHERE id = ?`, [created.lastInsertId])
      const updatedInvoice = await recalculateInvoicePaymentStatus(db, invoiceId)
      res.status(201).json({ ok: true, payment, invoice: updatedInvoice })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to record payment.' })
    }
  })

  router.patch('/invoices/:id/payments/:paymentId', async (req, res) => {
    const invoiceId = toInt(req.params.id, 0)
    const paymentId = toInt(req.params.paymentId, 0)
    if (!invoiceId || !paymentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM invoice_payments WHERE id = ? AND invoice_id = ?`, [paymentId, invoiceId])
      if (!row) return res.status(404).json({ ok: false, error: 'Payment not found.' })
      const nextAmount = body.amount != null ? toDecimal(body.amount, NaN) : Number(row.amount)
      const nextMethod = body.payment_method != null ? String(body.payment_method).trim().toLowerCase() : String(row.payment_method || 'other')
      const nextType = body.payment_type != null ? String(body.payment_type).trim().toLowerCase() : String(row.payment_type || 'partial')
      const nextStatus = body.status != null ? String(body.status).trim().toLowerCase() : String(row.status || 'recorded')
      const nextRef = body.payment_reference != null ? String(body.payment_reference).trim() || null : row.payment_reference
      const nextNotes = body.notes != null ? String(body.notes).trim() || null : row.notes
      const nextPaidAt = body.paid_at != null ? (String(body.paid_at).trim() || null) : row.paid_at
      if (!PAYMENT_TYPES.has(nextType)) return res.status(400).json({ ok: false, error: 'Invalid payment_type.' })
      if (!PAYMENT_METHODS.has(nextMethod)) return res.status(400).json({ ok: false, error: 'Invalid payment_method.' })
      if (!PAYMENT_STATUSES.has(nextStatus)) return res.status(400).json({ ok: false, error: 'Invalid payment status.' })
      if (!Number.isFinite(nextAmount)) return res.status(400).json({ ok: false, error: 'Amount must be numeric.' })
      if ((nextType === 'refund' || nextType === 'credit') ? nextAmount >= 0 : nextAmount <= 0) {
        return res.status(400).json({ ok: false, error: 'Amount sign is invalid for this payment type.' })
      }
      await db.run(
        `UPDATE invoice_payments
         SET amount = ?, payment_method = ?, payment_type = ?, payment_reference = ?, notes = ?, status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [round2(nextAmount), nextMethod, nextType, nextRef, nextNotes, nextStatus, nextPaidAt, paymentId],
      )
      const payment = await db.get(`SELECT * FROM invoice_payments WHERE id = ?`, [paymentId])
      const updatedInvoice = await recalculateInvoicePaymentStatus(db, invoiceId)
      res.json({ ok: true, payment, invoice: updatedInvoice })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update payment.' })
    }
  })

  router.delete('/invoices/:id/payments/:paymentId', async (req, res) => {
    const invoiceId = toInt(req.params.id, 0)
    const paymentId = toInt(req.params.paymentId, 0)
    if (!invoiceId || !paymentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    try {
      await db.run(`DELETE FROM invoice_payments WHERE id = ? AND invoice_id = ?`, [paymentId, invoiceId])
      const updatedInvoice = await recalculateInvoicePaymentStatus(db, invoiceId)
      res.json({ ok: true, invoice: updatedInvoice })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to remove payment.' })
    }
  })

  router.post('/invoices/:id/recalculate-payment-status', async (req, res) => {
    const invoiceId = toInt(req.params.id, 0)
    if (!invoiceId) return res.status(400).json({ ok: false, error: 'Invalid invoice id.' })
    try {
      const invoice = await recalculateInvoicePaymentStatus(db, invoiceId)
      if (!invoice) return res.status(404).json({ ok: false, error: 'Invoice not found.' })
      res.json({ ok: true, invoice })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to recalculate payment status.' })
    }
  })

  router.get('/payments/summary', async (req, res) => {
    const range = String(req.query.range || '30d')
    const map = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }
    const days = map[range] || 30
    try {
      const totals = await db.get(
        `SELECT
          COALESCE(SUM(CASE WHEN status NOT IN ('failed','cancelled') THEN amount ELSE 0 END), 0) AS net_amount,
          COALESCE(SUM(CASE WHEN payment_type IN ('refund','credit') OR status = 'refunded' THEN ABS(amount) ELSE 0 END), 0) AS refunds_total,
          COUNT(*) AS payments_count
         FROM invoice_payments
         WHERE COALESCE(paid_at, created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days],
      )
      res.json({ ok: true, range, days, summary: totals || { net_amount: 0, refunds_total: 0, payments_count: 0 } })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load payments summary.' })
    }
  })

  return router
}

module.exports = {
  createInvoicesRouter,
}
