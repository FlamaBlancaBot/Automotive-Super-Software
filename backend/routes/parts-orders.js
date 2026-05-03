'use strict'

const express = require('express')
const { toOperationalUpper } = require('../db/utils')
const { logActivity } = require('../lib/activity')

const PART_ORDER_STATUSES = [
  'pending',
  'ordered',
  'received',
  'cancelled',
  'return_required',
  'returned',
  'credit_pending',
  'credited',
]

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toDecimal(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function roundMoney(value) {
  return Math.round(toDecimal(value, 0) * 100) / 100
}

function truthy(value) {
  const v = String(value || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

function isValidStatus(status) {
  return PART_ORDER_STATUSES.includes(String(status || '').trim())
}

function normalisePartsStatus(status) {
  const raw = String(status || '').trim().toLowerCase()
  if (!raw) return 'pending'
  if (PART_ORDER_STATUSES.includes(raw)) return raw
  if (raw === 'to_order') return 'pending'
  if (raw === 'expected' || raw === 'partially_received') return 'ordered'
  if (raw === 'goods_received' || raw === 'fitted') return 'received'
  if (raw === 'wrong_part') return 'return_required'
  if (raw === 'awaiting_credit') return 'credit_pending'
  return raw
}

async function logStatusChange(tx, partsOrderId, oldStatus, newStatus, notes, changedBy) {
  await tx.run(
    `INSERT INTO part_status_logs (parts_order_id, old_status, new_status, notes, changed_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      partsOrderId,
      oldStatus != null ? String(oldStatus) : null,
      String(newStatus),
      notes ? toOperationalUpper(notes) : null,
      changedBy ? toOperationalUpper(changedBy) : null,
    ],
  )
}

function dueDateExpr() {
  // Prefer expected_at if set, otherwise fall back to eta_datetime.
  return `COALESCE(po.expected_at, po.eta_datetime)`
}

function createPartsOrdersRouter({ db }) {
  const router = express.Router()

  router.get('/parts-orders', async (req, res) => {
    const status = req.query.status ? String(req.query.status).trim() : ''
    const supplierId = req.query.supplier_id ? toInt(req.query.supplier_id, null) : null
    const registration = req.query.registration ? String(req.query.registration).trim() : ''
    const jobId = req.query.job_id ? toInt(req.query.job_id, null) : null
    const quoteId = req.query.quote_id ? toInt(req.query.quote_id, null) : null
    const q = req.query.q ? String(req.query.q).trim() : ''
    const due = req.query.due ? String(req.query.due).trim().toLowerCase() : ''

    try {
      const params = []
      const where = []

      if (status) {
        where.push(`po.status = ?`)
        params.push(normalisePartsStatus(status))
      }
      if (supplierId) {
        where.push(`po.supplier_id = ?`)
        params.push(supplierId)
      }
      if (jobId) {
        where.push(`po.job_id = ?`)
        params.push(jobId)
      }
      if (quoteId) {
        where.push(`po.quote_id = ?`)
        params.push(quoteId)
      }
      if (registration) {
        where.push(`v.registration LIKE ?`)
        params.push(`%${registration}%`)
      }
      if (q) {
        where.push(
          `(
            v.registration LIKE ?
            OR s.name LIKE ?
            OR po.part_name LIKE ?
            OR po.description LIKE ?
            OR po.brand LIKE ?
            OR po.part_number LIKE ?
          )`,
        )
        const like = `%${q}%`
        params.push(like, like, like, like, like, like)
      }

      const dueExpr = dueDateExpr()
      if (due === 'today') {
        where.push(`DATE(${dueExpr}) = CURDATE()`)
      } else if (due === 'overdue') {
        where.push(`${dueExpr} IS NOT NULL AND DATE(${dueExpr}) < CURDATE()`)
        where.push(`po.status NOT IN ('credited','cancelled')`)
      } else if (due === 'upcoming') {
        where.push(`${dueExpr} IS NOT NULL AND DATE(${dueExpr}) > CURDATE()`)
        where.push(`po.status NOT IN ('credited','cancelled')`)
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const rows = await db.all(
        `
        SELECT
          po.id,
          po.quote_item_id,
          po.selected_supplier_option_id,
          po.status,
          po.part_name,
          po.description,
          po.brand,
          po.part_number,
          po.quantity,
          po.cost_ex_vat,
          po.sell_ex_vat,
          po.vat_rate,
          po.eta_text,
          po.eta_datetime,
          po.ordered_at,
          po.expected_at,
          po.received_at,
          po.fitted_at,
          po.supplier_invoice_number,
          po.delivery_note_number,
          po.return_status,
          po.credit_note_number,
          po.updated_at,
          po.job_id,
          po.quote_id,
          po.vehicle_id,
          po.customer_id,
          po.supplier_id,
          v.registration AS vehicle_registration,
          v.make AS vehicle_make,
          v.model AS vehicle_model,
          j.title AS job_title,
          q.quote_number,
          s.name AS supplier_name
        FROM parts_orders po
        LEFT JOIN jobs j ON j.id = po.job_id
        LEFT JOIN vehicles v ON v.id = COALESCE(po.vehicle_id, j.vehicle_id)
        LEFT JOIN quotes q ON q.id = po.quote_id
        LEFT JOIN suppliers s ON s.id = po.supplier_id
        ${whereSql}
        ORDER BY
          FIELD(po.status, 'pending','ordered','received','return_required','returned','credit_pending','credited','cancelled') ASC,
          COALESCE(po.expected_at, po.eta_datetime) ASC,
          po.updated_at DESC,
          po.id DESC
        LIMIT 500
      `,
        params,
      )

      res.json({ ok: true, parts_orders: rows || [] })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load parts orders.' })
    }
  })

  router.get('/parts-orders/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid parts order id.' })

    try {
      const order = await db.get(`SELECT * FROM parts_orders WHERE id = ?`, [id])
      if (!order) return res.status(404).json({ ok: false, error: 'Parts order not found.' })

      const job = order.job_id
        ? await db.get(
            `
            SELECT j.*, st.name AS service_template_name
            FROM jobs j
            JOIN service_templates st ON st.id = j.service_template_id
            WHERE j.id = ?
          `,
            [order.job_id],
          )
        : null

      const quote = order.quote_id ? await db.get(`SELECT * FROM quotes WHERE id = ?`, [order.quote_id]) : null
      const vehicle = order.vehicle_id
        ? await db.get(`SELECT * FROM vehicles WHERE id = ?`, [order.vehicle_id])
        : job
          ? await db.get(`SELECT * FROM vehicles WHERE id = ?`, [job.vehicle_id])
          : null
      const customer = order.customer_id
        ? await db.get(`SELECT * FROM customers WHERE id = ?`, [order.customer_id])
        : job
          ? await db.get(`SELECT * FROM customers WHERE id = ?`, [job.customer_id])
          : null
      const supplier = order.supplier_id ? await db.get(`SELECT * FROM suppliers WHERE id = ?`, [order.supplier_id]) : null

      const goods = await db.all(
        `
        SELECT *
        FROM goods_received
        WHERE parts_order_id = ?
        ORDER BY received_at DESC, id DESC
      `,
        [id],
      )

      const logs = await db.all(
        `
        SELECT *
        FROM part_status_logs
        WHERE parts_order_id = ?
        ORDER BY created_at DESC, id DESC
      `,
        [id],
      )

      res.json({
        ok: true,
        parts_order: order,
        job,
        quote,
        vehicle,
        customer,
        supplier,
        goods_received: goods || [],
        status_logs: logs || [],
      })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load parts order.' })
    }
  })

  router.patch('/parts-orders/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid parts order id.' })

    const body = req.body || {}

    const patch = {
      supplier_invoice_number:
        body.supplier_invoice_number != null
          ? toOperationalUpper(body.supplier_invoice_number) || null
          : undefined,
      delivery_note_number:
        body.delivery_note_number != null
          ? toOperationalUpper(body.delivery_note_number) || null
          : undefined,
      expected_at: body.expected_at != null ? String(body.expected_at).trim() || null : undefined,
      eta_text: body.eta_text != null ? toOperationalUpper(body.eta_text) || null : undefined,
      notes: body.notes != null ? toOperationalUpper(body.notes) || null : undefined,
      brand: body.brand != null ? toOperationalUpper(body.brand) || null : undefined,
      part_number: body.part_number != null ? toOperationalUpper(body.part_number) || null : undefined,
      cost_ex_vat: body.cost_ex_vat != null ? roundMoney(body.cost_ex_vat) : undefined,
      sell_ex_vat: body.sell_ex_vat != null ? roundMoney(body.sell_ex_vat) : undefined,
    }

    try {
      const updated = await db.transaction(async (tx) => {
        const order = await tx.get(`SELECT * FROM parts_orders WHERE id = ?`, [id])
        if (!order) {
          const err = new Error('Parts order not found.')
          err.status = 404
          throw err
        }

        await tx.run(
          `
          UPDATE parts_orders
          SET
            supplier_invoice_number = COALESCE(?, supplier_invoice_number),
            delivery_note_number = COALESCE(?, delivery_note_number),
            expected_at = COALESCE(?, expected_at),
            eta_text = COALESCE(?, eta_text),
            notes = COALESCE(?, notes),
            brand = COALESCE(?, brand),
            part_number = COALESCE(?, part_number),
            cost_ex_vat = COALESCE(?, cost_ex_vat),
            sell_ex_vat = COALESCE(?, sell_ex_vat),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [
            patch.supplier_invoice_number === undefined ? null : patch.supplier_invoice_number,
            patch.delivery_note_number === undefined ? null : patch.delivery_note_number,
            patch.expected_at === undefined ? null : patch.expected_at,
            patch.eta_text === undefined ? null : patch.eta_text,
            patch.notes === undefined ? null : patch.notes,
            patch.brand === undefined ? null : patch.brand,
            patch.part_number === undefined ? null : patch.part_number,
            patch.cost_ex_vat === undefined ? null : patch.cost_ex_vat,
            patch.sell_ex_vat === undefined ? null : patch.sell_ex_vat,
            id,
          ],
        )

        return tx.get(`SELECT * FROM parts_orders WHERE id = ?`, [id])
      })

      res.json({ ok: true, parts_order: updated })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to update parts order.' })
    }
  })

  router.patch('/parts-orders/:id/status', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid parts order id.' })

    const body = req.body || {}
    const nextStatus = normalisePartsStatus(body.status || '')
    const notes = body.notes != null ? toOperationalUpper(body.notes) : null
    const changedBy = body.changed_by != null ? toOperationalUpper(body.changed_by) : null

    if (!isValidStatus(nextStatus)) {
      return res.status(400).json({ ok: false, error: 'Invalid status.' })
    }

    try {
      const out = await db.transaction(async (tx) => {
        const order = await tx.get(`SELECT * FROM parts_orders WHERE id = ?`, [id])
        if (!order) {
          const err = new Error('Parts order not found.')
          err.status = 404
          throw err
        }

        const oldStatus = order.status

        await tx.run(
          `
          UPDATE parts_orders
          SET
            status = ?,
            ordered_at = CASE WHEN ? = 'ordered' AND ordered_at IS NULL THEN CURRENT_TIMESTAMP ELSE ordered_at END,
            received_at = CASE WHEN ? = 'received' AND received_at IS NULL THEN CURRENT_TIMESTAMP ELSE received_at END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [nextStatus, nextStatus, nextStatus, id],
        )

        await logStatusChange(tx, id, oldStatus, nextStatus, notes, changedBy)

        return tx.get(`SELECT * FROM parts_orders WHERE id = ?`, [id])
      })

      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'parts_order',
        entityId: out.id,
        action: 'parts_status_changed',
        summary: `PARTS ORDER STATUS CHANGED TO ${String(out.status || '').toUpperCase()}`,
      })
      res.json({ ok: true, parts_order: out })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to update status.' })
    }
  })

  router.post('/parts-orders/:id/goods-received', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid parts order id.' })

    const body = req.body || {}
    const quantityReceived = toDecimal(body.quantity_received, null)
    if (quantityReceived == null || quantityReceived <= 0) {
      return res.status(400).json({ ok: false, error: 'quantity_received is required.' })
    }

    const receivedBy = body.received_by != null ? toOperationalUpper(body.received_by) || null : null
    const invoice =
      body.supplier_invoice_number != null
        ? toOperationalUpper(body.supplier_invoice_number) || null
        : null
    const delivery =
      body.delivery_note_number != null
        ? toOperationalUpper(body.delivery_note_number) || null
        : null
    const correctPart = body.correct_part === false || body.correct_part === 0 ? 0 : 1
    const conditionOk = body.condition_ok === false || body.condition_ok === 0 ? 0 : 1
    const returnRequired = truthy(body.return_required) ? 1 : 0
    const notes = body.notes != null ? toOperationalUpper(body.notes) || null : null

    try {
      const out = await db.transaction(async (tx) => {
        const order = await tx.get(`SELECT * FROM parts_orders WHERE id = ?`, [id])
        if (!order) {
          const err = new Error('Parts order not found.')
          err.status = 404
          throw err
        }

        await tx.run(
          `INSERT INTO goods_received (
            parts_order_id, quantity_received, received_at, received_by,
            supplier_invoice_number, delivery_note_number,
            correct_part, condition_ok, return_required, notes
          ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            roundMoney(quantityReceived),
            receivedBy,
            invoice,
            delivery,
            correctPart,
            conditionOk,
            returnRequired,
            notes,
          ],
        )

        // Decide next status.
        let nextStatus = 'received'
        if (!correctPart) nextStatus = 'return_required'
        else if (returnRequired) nextStatus = 'return_required'

        const oldStatus = order.status
        await tx.run(
          `
          UPDATE parts_orders
          SET
            received_at = CURRENT_TIMESTAMP,
            received_by = COALESCE(?, received_by),
            supplier_invoice_number = COALESCE(?, supplier_invoice_number),
            delivery_note_number = COALESCE(?, delivery_note_number),
            status = ?,
            return_status = CASE
              WHEN ? = 'return_required' THEN 'return_required'
              ELSE return_status
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [receivedBy, invoice, delivery, nextStatus, nextStatus, id],
        )

        await logStatusChange(tx, id, oldStatus, nextStatus, notes, receivedBy)

        const updated = await tx.get(`SELECT * FROM parts_orders WHERE id = ?`, [id])
        const goods = await tx.all(
          `SELECT * FROM goods_received WHERE parts_order_id = ? ORDER BY received_at DESC, id DESC`,
          [id],
        )

        return { parts_order: updated, goods_received: goods || [] }
      })

      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'parts_order',
        entityId: out.parts_order ? out.parts_order.id : id,
        action: 'goods_received_recorded',
        summary: `GOODS RECEIVED FOR PARTS ORDER #${id}`,
      })
      res.status(201).json({ ok: true, ...out })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to record goods received.' })
    }
  })

  router.post('/parts-orders', async (req, res) => {
    const body = req.body || {}
    const partName = body.part_name != null ? toOperationalUpper(body.part_name) : ''
    const description = body.description != null ? toOperationalUpper(body.description) : null
    const quantity = body.quantity != null ? toDecimal(body.quantity, 1) : 1

    if (!partName) return res.status(400).json({ ok: false, error: 'part_name is required.' })

    const jobId = body.job_id ? toInt(body.job_id, null) : null
    const quoteId = body.quote_id ? toInt(body.quote_id, null) : null
    const vehicleId = body.vehicle_id ? toInt(body.vehicle_id, null) : null
    const customerId = body.customer_id ? toInt(body.customer_id, null) : null
    const supplierId = body.supplier_id ? toInt(body.supplier_id, null) : null
    const brand = body.brand != null ? toOperationalUpper(body.brand) || null : null
    const partNumber =
      body.part_number != null ? toOperationalUpper(body.part_number) || null : null
    const cost = body.cost_ex_vat != null ? roundMoney(body.cost_ex_vat) : 0
    const sell = body.sell_ex_vat != null ? roundMoney(body.sell_ex_vat) : 0
    const vatRate = body.vat_rate != null ? toDecimal(body.vat_rate, 0.2) : 0.2
    const etaText = body.eta_text != null ? toOperationalUpper(body.eta_text) || null : null
    const expectedAt = body.expected_at != null ? String(body.expected_at).trim() || null : null
    const status = body.status && isValidStatus(normalisePartsStatus(body.status))
      ? normalisePartsStatus(body.status)
      : 'pending'

    try {
      const out = await db.transaction(async (tx) => {
        const created = await tx.run(
          `INSERT INTO parts_orders (
            job_id, quote_id, vehicle_id, customer_id, supplier_id,
            part_name, description, brand, part_number, quantity,
            cost_ex_vat, sell_ex_vat, vat_rate, eta_text, expected_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            jobId,
            quoteId,
            vehicleId,
            customerId,
            supplierId,
            partName,
            description,
            brand,
            partNumber,
            roundMoney(quantity),
            cost,
            sell,
            vatRate,
            etaText,
            expectedAt,
            status,
          ],
        )

        await logStatusChange(tx, created.lastInsertId, null, status, 'Manual create', null)
        return tx.get(`SELECT * FROM parts_orders WHERE id = ?`, [created.lastInsertId])
      })

      res.status(201).json({ ok: true, parts_order: out })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to create parts order.' })
    }
  })

  return router
}

module.exports = {
  PART_ORDER_STATUSES,
  createPartsOrdersRouter,
}
