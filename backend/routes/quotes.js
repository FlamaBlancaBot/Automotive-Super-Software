'use strict'

const express = require('express')
const { normaliseOperationalText } = require('../db/utils')
const { logActivity } = require('../lib/activity')

const QUOTE_STATUSES = [
  'draft',
  'ready',
  'sent',
  'accepted',
  'rejected',
  'completed',
]

const ITEM_TYPES = [
  'labour',
  'part',
  'diagnostic',
  'mot_repair',
  'oil',
  'service_item',
  'other',
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

function pad4(n) {
  return String(n).padStart(4, '0')
}

function truthy(value) {
  const v = String(value || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

async function recalculateQuote(tx, quoteId) {
  const quote = await tx.get(`SELECT id, vat_rate FROM quotes WHERE id = ?`, [quoteId])
  if (!quote) {
    const err = new Error('Quote not found.')
    err.status = 404
    throw err
  }

  const vatRateDefault = toDecimal(quote.vat_rate, 0.2)

  const sums = await tx.get(
    `
    SELECT
      COALESCE(SUM(total_cost), 0) AS subtotal_cost,
      COALESCE(SUM(total_sell), 0) AS subtotal_sell,
      COALESCE(SUM(total_sell * COALESCE(vat_rate, ?)), 0) AS vat_amount
    FROM quote_items
    WHERE quote_id = ?
      AND selected_for_quote = 1
  `,
    [vatRateDefault, quoteId],
  )

  const subtotalCost = roundMoney(sums ? sums.subtotal_cost : 0)
  const subtotalSell = roundMoney(sums ? sums.subtotal_sell : 0)
  const vatAmount = roundMoney(sums ? sums.vat_amount : 0)
  const totalSell = roundMoney(subtotalSell + vatAmount)
  const margin = roundMoney(subtotalSell - subtotalCost)

  await tx.run(
    `
    UPDATE quotes
    SET
      subtotal_cost = ?,
      subtotal_sell = ?,
      vat_amount = ?,
      total_sell = ?,
      estimated_margin = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `,
    [subtotalCost, subtotalSell, vatAmount, totalSell, margin, quoteId],
  )

  const updated = await tx.get(
    `SELECT id, quote_number, status, title, subtotal_cost, subtotal_sell, vat_rate, vat_amount, total_sell, estimated_margin, updated_at
     FROM quotes WHERE id = ?`,
    [quoteId],
  )

  return updated
}

async function generateQuoteNumber(tx) {
  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`

  // Lock the latest row we look at to reduce the chance of duplicates.
  const last = await tx.get(
    `SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`],
  )

  let next = 1
  if (last && last.quote_number) {
    const m = String(last.quote_number).match(/Q-\d{4}-(\d{4})$/)
    if (m && m[1]) next = Number(m[1]) + 1
  }

  return `${prefix}${pad4(next)}`
}

function computeItemTotals(quantity, unitCost, unitSell) {
  const qty = Math.max(0.01, toDecimal(quantity, 1))
  const cost = Math.max(0, toDecimal(unitCost, 0))
  const sell = Math.max(0, toDecimal(unitSell, 0))
  return {
    quantity: roundMoney(qty),
    unit_cost: roundMoney(cost),
    unit_sell: roundMoney(sell),
    total_cost: roundMoney(qty * cost),
    total_sell: roundMoney(qty * sell),
  }
}

function isPhysicalOrSupplierItemType(itemType) {
  const t = String(itemType || '').trim()
  return t === 'part' || t === 'oil' || t === 'service_item' || t === 'mot_repair'
}

async function logPartStatus(tx, partsOrderId, oldStatus, newStatus, notes) {
  await tx.run(
    `INSERT INTO part_status_logs (parts_order_id, old_status, new_status, notes)
     VALUES (?, ?, ?, ?)`,
    [
      partsOrderId,
      oldStatus != null ? String(oldStatus) : null,
      String(newStatus),
      notes ? String(notes).trim() : null,
    ],
  )
}

async function ensurePartsOrdersForAcceptedQuote(tx, quoteId) {
  const quote = await tx.get(
    `SELECT id, job_id, vehicle_id, customer_id, status, vat_rate FROM quotes WHERE id = ?`,
    [quoteId],
  )
  if (!quote) {
    const err = new Error('Quote not found.')
    err.status = 404
    throw err
  }

  const items = await tx.all(
    `
    SELECT *
    FROM quote_items
    WHERE quote_id = ?
      AND selected_for_quote = 1
    ORDER BY sort_order ASC, id ASC
  `,
    [quoteId],
  )

  let created = 0
  let existing = 0

  for (const item of items || []) {
    const itemType = String(item.item_type || '')

    const selectedOption = await tx.get(
      `
      SELECT *
      FROM part_supplier_options
      WHERE quote_item_id = ?
        AND is_selected = 1
      LIMIT 1
    `,
      [item.id],
    )

    const supplierId = item.supplier_id || (selectedOption ? selectedOption.supplier_id : null)

    // Only create parts orders for supplier-related lines (or physical types).
    const isPhysical = isPhysicalOrSupplierItemType(itemType)
    const isSupplierRelated = Boolean(supplierId)
    if (!isSupplierRelated && !isPhysical) continue
    if (!supplierId) continue

    const already = await tx.get(
      `SELECT id FROM parts_orders WHERE quote_item_id = ? LIMIT 1`,
      [item.id],
    )
    if (already && already.id) {
      existing += 1
      continue
    }

    const partName = String(item.description || '').trim() || 'Part'
    const brand = item.part_brand || (selectedOption ? selectedOption.brand : null) || null
    const partNumber = item.part_number || (selectedOption ? selectedOption.part_number : null) || null
    const etaText = item.eta_text || (selectedOption ? selectedOption.eta_text : null) || null
    const etaDateTime = selectedOption ? selectedOption.eta_datetime : null

    const vatRate = item.vat_rate != null ? item.vat_rate : quote.vat_rate

    const inserted = await tx.run(
      `INSERT INTO parts_orders (
        job_id, quote_id, quote_item_id, selected_supplier_option_id,
        vehicle_id, customer_id, supplier_id,
        part_name, description, brand, part_number,
        quantity, cost_ex_vat, sell_ex_vat, vat_rate,
        eta_text, eta_datetime,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        quote.job_id || null,
        quote.id,
        item.id,
        selectedOption ? selectedOption.id : null,
        quote.vehicle_id || null,
        quote.customer_id || null,
        supplierId,
        partName,
        partName,
        brand,
        partNumber,
        item.quantity != null ? item.quantity : 1,
        item.unit_cost != null ? item.unit_cost : 0,
        item.unit_sell != null ? item.unit_sell : 0,
        vatRate != null ? vatRate : 0.2,
        etaText,
        etaDateTime,
      ],
    )

    created += 1
    await logPartStatus(tx, inserted.lastInsertId, null, 'pending', 'Created from accepted quote')
  }

  if (quote.job_id) {
    const job = await tx.get(`SELECT id, status FROM jobs WHERE id = ?`, [quote.job_id])
    if (job && job.id) {
      const current = String(job.status || '').toLowerCase()
      if (current !== 'completed' && current !== 'in_progress') {
        const nextJobStatus = created > 0 || existing > 0 ? 'awaiting_parts_order' : 'in_progress'
        await tx.run(
          `UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [nextJobStatus, quote.job_id],
        )
      }
    }
  }

  return { created, existing }
}

function createQuotesRouter({ db }) {
  const router = express.Router()

  router.get('/quotes', async (req, res) => {
    try {
      const rows = await db.all(
        `
        SELECT
          q.id,
          q.quote_number,
          q.status,
          q.title,
          q.total_sell,
          q.updated_at,
          v.registration AS vehicle_registration,
          v.make AS vehicle_make,
          v.model AS vehicle_model,
          c.first_name AS customer_first_name,
          c.surname AS customer_surname
        FROM quotes q
        JOIN vehicles v ON v.id = q.vehicle_id
        JOIN customers c ON c.id = q.customer_id
        ORDER BY q.updated_at DESC
        LIMIT 200
      `,
      )
      res.json({ ok: true, quotes: rows })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load quotes.' })
    }
  })

  router.get('/quotes/:id', async (req, res) => {
    const quoteId = toInt(req.params.id, 0)
    if (!quoteId) return res.status(400).json({ ok: false, error: 'Invalid quote id.' })

    try {
      const quote = await db.get(
        `
        SELECT
          q.*,
          v.registration AS vehicle_registration,
          v.make AS vehicle_make,
          v.model AS vehicle_model,
          c.first_name AS customer_first_name,
          c.surname AS customer_surname,
          c.phone AS customer_phone,
          c.email AS customer_email,
          c.postcode AS customer_postcode,
          c.address AS customer_address
        FROM quotes q
        JOIN vehicles v ON v.id = q.vehicle_id
        JOIN customers c ON c.id = q.customer_id
        WHERE q.id = ?
      `,
        [quoteId],
      )

      if (!quote) return res.status(404).json({ ok: false, error: 'Quote not found.' })

      const items = await db.all(
        `
        SELECT *
        FROM quote_items
        WHERE quote_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
        [quoteId],
      )

      const itemIds = items.map((x) => x.id).filter(Boolean)
      let options = []
      if (itemIds.length) {
        const placeholders = itemIds.map(() => '?').join(',')
        options = await db.all(
          `
          SELECT
            pso.*,
            s.name AS supplier_name
          FROM part_supplier_options pso
          JOIN suppliers s ON s.id = pso.supplier_id
          WHERE pso.quote_item_id IN (${placeholders})
          ORDER BY pso.quote_item_id ASC, pso.is_selected DESC, pso.id ASC
        `,
          itemIds,
        )
      }

      const byItemId = new Map()
      for (const opt of options) {
        const key = opt.quote_item_id
        if (!byItemId.has(key)) byItemId.set(key, [])
        byItemId.get(key).push(opt)
      }

      const itemsWithOptions = items.map((item) => ({
        ...item,
        supplier_options: byItemId.get(item.id) || [],
      }))

      res.json({ ok: true, quote, items: itemsWithOptions })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load quote.' })
    }
  })

  router.patch('/quotes/:id', async (req, res) => {
    const quoteId = toInt(req.params.id, 0)
    if (!quoteId) return res.status(400).json({ ok: false, error: 'Invalid quote id.' })

    const body = req.body || {}
    const title = body.title != null ? normaliseOperationalText(body.title) : null
    const internalNotes =
      body.internal_notes != null ? normaliseOperationalText(body.internal_notes) : null
    const customerNotes = body.customer_notes != null ? String(body.customer_notes).trim() : null
    const vatRate = body.vat_rate != null && body.vat_rate !== '' ? toDecimal(body.vat_rate, null) : null

    if (title != null && !title) return res.status(400).json({ ok: false, error: 'Title cannot be empty.' })
    if (vatRate != null && (vatRate < 0 || vatRate > 1)) {
      return res.status(400).json({ ok: false, error: 'Invalid VAT rate.' })
    }

    try {
      const updated = await db.transaction(async (tx) => {
        const quote = await tx.get(`SELECT * FROM quotes WHERE id = ?`, [quoteId])
        if (!quote) {
          const err = new Error('Quote not found.')
          err.status = 404
          throw err
        }

        await tx.run(
          `
          UPDATE quotes
          SET
            title = COALESCE(?, title),
            internal_notes = COALESCE(?, internal_notes),
            customer_notes = COALESCE(?, customer_notes),
            vat_rate = COALESCE(?, vat_rate),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [title, internalNotes, customerNotes, vatRate, quoteId],
        )

        await recalculateQuote(tx, quoteId)

        return tx.get(
          `SELECT * FROM quotes WHERE id = ?`,
          [quoteId],
        )
      })

      res.json({ ok: true, quote: updated })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to update quote.' })
    }
  })

  router.post('/quotes', async (req, res) => {
    const body = req.body || {}
    const customerId = toInt(body.customer_id, 0)
    const vehicleId = toInt(body.vehicle_id, 0)
    const jobId = body.job_id ? toInt(body.job_id, null) : null
    const title = normaliseOperationalText(body.title)

    if (!customerId || !vehicleId) {
      return res.status(400).json({ ok: false, error: 'customer_id and vehicle_id are required.' })
    }
    if (!title) return res.status(400).json({ ok: false, error: 'Quote title is required.' })

    const internalNotes = body.internal_notes ? normaliseOperationalText(body.internal_notes) : null
    const customerNotes = body.customer_notes ? String(body.customer_notes).trim() : null

    try {
      const out = await db.transaction(async (tx) => {
        const customer = await tx.get(`SELECT id FROM customers WHERE id = ?`, [customerId])
        const vehicle = await tx.get(`SELECT id FROM vehicles WHERE id = ?`, [vehicleId])
        if (!customer || !vehicle) {
          const err = new Error('Customer or vehicle not found.')
          err.status = 400
          throw err
        }

        const status = 'draft'
        let quoteNumber = await generateQuoteNumber(tx)

        // Small retry loop in case of duplicate numbers.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            const created = await tx.run(
              `INSERT INTO quotes (
                quote_number, customer_id, vehicle_id, job_id, status, title,
                internal_notes, customer_notes,
                subtotal_cost, subtotal_sell, vat_rate, vat_amount, total_sell, estimated_margin
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0.2000, 0, 0, 0)`,
              [quoteNumber, customerId, vehicleId, jobId, status, title, internalNotes, customerNotes],
            )

            const quoteId = created.lastInsertId
            const recalculated = await recalculateQuote(tx, quoteId)
            const quote = await tx.get(`SELECT * FROM quotes WHERE id = ?`, [quoteId])
            return { quote, totals: recalculated }
          } catch (e) {
            const code = e && e.code ? String(e.code) : ''
            if (code !== 'ER_DUP_ENTRY') throw e
            const m = quoteNumber.match(/^(Q-\d{4}-)(\d{4})$/)
            const seq = m && m[2] ? Number(m[2]) : 1
            const prefix = m && m[1] ? m[1] : `Q-${new Date().getFullYear()}-`
            quoteNumber = `${prefix}${pad4(seq + 1)}`
          }
        }

        throw new Error('Failed to generate a unique quote number.')
      })

      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'quote',
        entityId: out.quote.id,
        action: 'quote_created',
        summary: `QUOTE CREATED ${out.quote.quote_number}`,
      })
      res.status(201).json({ ok: true, quote: out.quote })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to create quote.' })
    }
  })

  router.post('/quotes/:id/items', async (req, res) => {
    const quoteId = toInt(req.params.id, 0)
    if (!quoteId) return res.status(400).json({ ok: false, error: 'Invalid quote id.' })

    const body = req.body || {}
    const itemType = String(body.item_type || '').trim().toLowerCase()
    const description = normaliseOperationalText(body.description)
    if (!ITEM_TYPES.includes(itemType)) return res.status(400).json({ ok: false, error: 'Invalid item_type.' })
    if (!description) return res.status(400).json({ ok: false, error: 'Item description is required.' })

    const quantity = body.quantity == null ? 1 : body.quantity
    const unitCost = body.unit_cost == null ? 0 : body.unit_cost
    const markupPercent =
      body.markup_percent == null || body.markup_percent === ''
        ? null
        : toDecimal(body.markup_percent, null)
    const vatRate =
      body.vat_rate == null || body.vat_rate === ''
        ? 0.2
        : toDecimal(body.vat_rate, 0.2)
    const etaText = body.eta_text != null ? normaliseOperationalText(body.eta_text) : null

    let unitSell = body.unit_sell == null || body.unit_sell === '' ? null : body.unit_sell
    if (unitSell == null && markupPercent != null) {
      unitSell = roundMoney(toDecimal(unitCost, 0) * (1 + toDecimal(markupPercent, 0) / 100))
    }
    if (unitSell == null) unitSell = 0
    const supplierId = body.supplier_id ? toInt(body.supplier_id, null) : null
    const partBrand = body.part_brand ? normaliseOperationalText(body.part_brand) : null
    const partNumber = body.part_number ? normaliseOperationalText(body.part_number) : null
    const selectedForQuote = body.selected_for_quote === 0 || body.selected_for_quote === false ? 0 : 1

    try {
      const out = await db.transaction(async (tx) => {
        const quote = await tx.get(`SELECT id FROM quotes WHERE id = ?`, [quoteId])
        if (!quote) {
          const err = new Error('Quote not found.')
          err.status = 404
          throw err
        }

        const sortRow = await tx.get(`SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM quote_items WHERE quote_id = ?`, [quoteId])
        const sortOrder = Number(sortRow && sortRow.max_sort ? sortRow.max_sort : 0) + 10

        const itemTotals = computeItemTotals(quantity, unitCost, unitSell)
        const created = await tx.run(
          `INSERT INTO quote_items (
            quote_id, item_type, description, quantity,
            unit_cost, unit_sell, markup_percent, vat_rate, eta_text,
            total_cost, total_sell,
            supplier_id, part_brand, part_number,
            selected_for_quote, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            quoteId,
            itemType,
            description,
            itemTotals.quantity,
            itemTotals.unit_cost,
            itemTotals.unit_sell,
            markupPercent,
            vatRate,
            etaText,
            itemTotals.total_cost,
            itemTotals.total_sell,
            supplierId,
            partBrand,
            partNumber,
            selectedForQuote,
            sortOrder,
          ],
        )

        const totals = await recalculateQuote(tx, quoteId)

        const item = await tx.get(`SELECT * FROM quote_items WHERE id = ?`, [created.lastInsertId])
        return { item, totals }
      })

      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'quote',
        entityId: quoteId,
        action: 'quote_item_added',
        summary: `QUOTE ITEM ADDED: ${out.item.description}`,
        metadata: { quote_item_id: out.item.id },
      })
      res.status(201).json({ ok: true, item: out.item, totals: out.totals })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to add quote item.' })
    }
  })

  router.patch('/quotes/:id/items/:itemId', async (req, res) => {
    const quoteId = toInt(req.params.id, 0)
    const itemId = toInt(req.params.itemId, 0)
    if (!quoteId || !itemId) return res.status(400).json({ ok: false, error: 'Invalid id.' })

    const body = req.body || {}

    try {
      const out = await db.transaction(async (tx) => {
        const item = await tx.get(`SELECT * FROM quote_items WHERE id = ? AND quote_id = ?`, [itemId, quoteId])
        if (!item) {
          const err = new Error('Quote item not found.')
          err.status = 404
          throw err
        }

        const nextType = body.item_type ? String(body.item_type).trim().toLowerCase() : item.item_type
        if (!ITEM_TYPES.includes(nextType)) {
          const err = new Error('Invalid item_type.')
          err.status = 400
          throw err
        }

        const description =
          body.description != null ? normaliseOperationalText(body.description) : item.description
        const supplierId = body.supplier_id != null ? toInt(body.supplier_id, null) : item.supplier_id
        const partBrand =
          body.part_brand != null ? normaliseOperationalText(body.part_brand) : item.part_brand
        const partNumber =
          body.part_number != null ? normaliseOperationalText(body.part_number) : item.part_number
        const etaText =
          body.eta_text != null ? normaliseOperationalText(body.eta_text) : item.eta_text
        const markupPercent =
          body.markup_percent != null && body.markup_percent !== ''
            ? toDecimal(body.markup_percent, null)
            : item.markup_percent
        const vatRate =
          body.vat_rate != null && body.vat_rate !== ''
            ? toDecimal(body.vat_rate, 0.2)
            : item.vat_rate
        const selectedForQuote =
          body.selected_for_quote != null ? (body.selected_for_quote ? 1 : 0) : item.selected_for_quote

        const unitCostNext = body.unit_cost != null ? body.unit_cost : item.unit_cost
        let unitSellNext = body.unit_sell != null ? body.unit_sell : item.unit_sell
        if (
          (body.unit_sell == null || body.unit_sell === '') &&
          body.markup_percent != null &&
          body.markup_percent !== ''
        ) {
          unitSellNext = roundMoney(
            toDecimal(unitCostNext, 0) * (1 + toDecimal(markupPercent, 0) / 100),
          )
        }

        const itemTotals = computeItemTotals(
          body.quantity != null ? body.quantity : item.quantity,
          unitCostNext,
          unitSellNext,
        )

        await tx.run(
          `
          UPDATE quote_items
          SET
            item_type = ?,
            description = ?,
            quantity = ?,
            unit_cost = ?,
            unit_sell = ?,
            markup_percent = ?,
            vat_rate = ?,
            eta_text = ?,
            total_cost = ?,
            total_sell = ?,
            supplier_id = ?,
            part_brand = ?,
            part_number = ?,
            selected_for_quote = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND quote_id = ?
        `,
          [
            nextType,
            description,
            itemTotals.quantity,
            itemTotals.unit_cost,
            itemTotals.unit_sell,
            markupPercent,
            vatRate == null ? 0.2 : vatRate,
            etaText,
            itemTotals.total_cost,
            itemTotals.total_sell,
            supplierId,
            partBrand,
            partNumber,
            selectedForQuote,
            itemId,
            quoteId,
          ],
        )

        const totals = await recalculateQuote(tx, quoteId)

        const updated = await tx.get(`SELECT * FROM quote_items WHERE id = ?`, [itemId])
        return { item: updated, totals }
      })

      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'quote',
        entityId: quoteId,
        action: 'quote_item_updated',
        summary: `QUOTE ITEM UPDATED: ${out.item.description}`,
        metadata: { quote_item_id: out.item.id },
      })
      res.json({ ok: true, item: out.item, totals: out.totals })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to update quote item.' })
    }
  })

  router.delete('/quotes/:id/items/:itemId', async (req, res) => {
    const quoteId = toInt(req.params.id, 0)
    const itemId = toInt(req.params.itemId, 0)
    if (!quoteId || !itemId) return res.status(400).json({ ok: false, error: 'Invalid id.' })

    try {
      await db.transaction(async (tx) => {
        const item = await tx.get(`SELECT id FROM quote_items WHERE id = ? AND quote_id = ?`, [itemId, quoteId])
        if (!item) return

        await tx.run(`DELETE FROM part_supplier_options WHERE quote_item_id = ?`, [itemId])
        await tx.run(`DELETE FROM quote_items WHERE id = ? AND quote_id = ?`, [itemId, quoteId])
        await recalculateQuote(tx, quoteId)
      })

      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to delete quote item.' })
    }
  })

  router.post('/quotes/:id/recalculate', async (req, res) => {
    const quoteId = toInt(req.params.id, 0)
    if (!quoteId) return res.status(400).json({ ok: false, error: 'Invalid quote id.' })

    try {
      const updated = await db.transaction((tx) => recalculateQuote(tx, quoteId))
      res.json({ ok: true, totals: updated })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to recalculate quote.' })
    }
  })

  router.patch('/quotes/:id/status', async (req, res) => {
    const quoteId = toInt(req.params.id, 0)
    if (!quoteId) return res.status(400).json({ ok: false, error: 'Invalid quote id.' })

    const nextStatus = String((req.body || {}).status || '').trim().toLowerCase()
    if (!QUOTE_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ ok: false, error: 'Invalid status.' })
    }

    try {
      const out = await db.transaction(async (tx) => {
        const quote = await tx.get(`SELECT * FROM quotes WHERE id = ?`, [quoteId])
        if (!quote) {
          const err = new Error('Quote not found.')
          err.status = 404
          throw err
        }

        const oldStatus = String(quote.status || '').toLowerCase()
        await tx.run(
          `UPDATE quotes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [nextStatus, quoteId],
        )

        let created = 0
        let existing = 0
        if (nextStatus === 'accepted') {
          const r = await ensurePartsOrdersForAcceptedQuote(tx, quoteId)
          created = r.created
          existing = r.existing
        }

        const updated = await tx.get(
          `SELECT id, quote_number, status, title, total_sell, updated_at, job_id FROM quotes WHERE id = ?`,
          [quoteId],
        )

        return {
          quote: updated,
          parts_orders_created: created,
          parts_orders_existing: existing,
          reused: nextStatus === 'accepted' && oldStatus === 'accepted' && existing > 0 && created === 0,
        }
      })
      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'quote',
        entityId: quoteId,
        action: 'quote_status_changed',
        summary: `QUOTE STATUS CHANGED TO ${String(out.quote.status || '').toUpperCase()}`,
        metadata: {
          parts_orders_created: out.parts_orders_created,
          parts_orders_existing: out.parts_orders_existing,
        },
      })
      res.json({ ok: true, ...out })
    } catch (err) {
      const code = err && err.status ? err.status : 500
      res.status(code).json({ ok: false, error: err.message || 'Failed to update quote status.' })
    }
  })

  router.post('/quote-items/:itemId/supplier-options', async (req, res) => {
    const itemId = toInt(req.params.itemId, 0)
    if (!itemId) return res.status(400).json({ ok: false, error: 'Invalid item id.' })

    const body = req.body || {}
    const supplierId = toInt(body.supplier_id, 0)
    if (!supplierId) return res.status(400).json({ ok: false, error: 'supplier_id is required.' })

    const partName = body.part_name ? normaliseOperationalText(body.part_name) : null
    const description = body.description ? normaliseOperationalText(body.description) : null
    const brand = body.brand ? normaliseOperationalText(body.brand) : null
    const partNumber = body.part_number ? normaliseOperationalText(body.part_number) : null
    const isAvailable = body.is_available === 0 || body.is_available === false ? 0 : 1
    const isOrdered = body.is_ordered === 1 || body.is_ordered === true ? 1 : 0
    const markupPercent =
      body.markup_percent == null || body.markup_percent === ''
        ? null
        : toDecimal(body.markup_percent, null)
    const vatRate =
      body.vat_rate == null || body.vat_rate === ''
        ? 0.2
        : toDecimal(body.vat_rate, 0.2)

    const costPrice = roundMoney(body.cost_price)
    let sellPrice = body.sell_price == null || body.sell_price === '' ? null : body.sell_price
    if (sellPrice == null && markupPercent != null) {
      sellPrice = roundMoney(toDecimal(costPrice, 0) * (1 + toDecimal(markupPercent, 0) / 100))
    }
    if (sellPrice == null) sellPrice = 0
    const etaText = body.eta_text ? normaliseOperationalText(body.eta_text) : null

    try {
      const out = await db.transaction(async (tx) => {
        const item = await tx.get(`SELECT id, quote_id, item_type FROM quote_items WHERE id = ?`, [itemId])
        if (!item) {
          const err = new Error('Quote item not found.')
          err.status = 404
          throw err
        }
        const itemType = String(item.item_type || '')
        if (itemType !== 'part' && itemType !== 'service_item') {
          const err = new Error(
            'Supplier options can only be added to part or service item rows.',
          )
          err.status = 400
          throw err
        }

        const supplier = await tx.get(`SELECT id FROM suppliers WHERE id = ?`, [supplierId])
        if (!supplier) {
          const err = new Error('Supplier not found.')
          err.status = 400
          throw err
        }

        const created = await tx.run(
          `INSERT INTO part_supplier_options (
            quote_item_id, supplier_id,
            part_name, description, brand, part_number,
            cost_price, sell_price, markup_percent, vat_rate, eta_text, eta_datetime,
            is_available, is_ordered, is_selected
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)`,
          [
            itemId,
            supplierId,
            partName,
            description,
            brand,
            partNumber,
            costPrice,
            sellPrice,
            markupPercent,
            vatRate,
            etaText,
            isAvailable,
            isOrdered,
          ],
        )

        const option = await tx.get(
          `SELECT pso.*, s.name AS supplier_name
           FROM part_supplier_options pso
           JOIN suppliers s ON s.id = pso.supplier_id
           WHERE pso.id = ?`,
          [created.lastInsertId],
        )

        // No automatic selection; user picks the option.
        await recalculateQuote(tx, item.quote_id)

        return option
      })

      res.status(201).json({ ok: true, option: out })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to add supplier option.' })
    }
  })

  router.patch('/part-supplier-options/:optionId/select', async (req, res) => {
    const optionId = toInt(req.params.optionId, 0)
    if (!optionId) return res.status(400).json({ ok: false, error: 'Invalid option id.' })

    try {
      const out = await db.transaction(async (tx) => {
        const option = await tx.get(
          `SELECT * FROM part_supplier_options WHERE id = ?`,
          [optionId],
        )
        if (!option) {
          const err = new Error('Supplier option not found.')
          err.status = 404
          throw err
        }
        if (Number(option.is_available) === 0) {
          const err = new Error('This supplier option is marked as not available.')
          err.status = 400
          throw err
        }

        const item = await tx.get(
          `SELECT * FROM quote_items WHERE id = ?`,
          [option.quote_item_id],
        )
        if (!item) {
          const err = new Error('Quote item not found.')
          err.status = 404
          throw err
        }

        await tx.run(
          `UPDATE part_supplier_options
           SET is_selected = CASE WHEN id = ? THEN 1 ELSE 0 END,
               updated_at = CURRENT_TIMESTAMP
           WHERE quote_item_id = ?`,
          [optionId, option.quote_item_id],
        )

        const totals = computeItemTotals(item.quantity, option.cost_price, option.sell_price)
        await tx.run(
          `
          UPDATE quote_items
          SET
            supplier_id = ?,
            part_brand = ?,
            part_number = ?,
            unit_cost = ?,
            unit_sell = ?,
            markup_percent = ?,
            vat_rate = ?,
            eta_text = ?,
            total_cost = ?,
            total_sell = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [
            option.supplier_id,
            option.brand || item.part_brand,
            option.part_number || item.part_number,
            totals.unit_cost,
            totals.unit_sell,
            option.markup_percent != null ? option.markup_percent : item.markup_percent,
            option.vat_rate != null ? option.vat_rate : item.vat_rate,
            option.eta_text != null ? option.eta_text : item.eta_text,
            totals.total_cost,
            totals.total_sell,
            item.id,
          ],
        )

        const updatedTotals = await recalculateQuote(tx, item.quote_id)
        const updatedItem = await tx.get(`SELECT * FROM quote_items WHERE id = ?`, [item.id])
        return { item: updatedItem, totals: updatedTotals }
      })

      res.json({ ok: true, ...out })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to select supplier option.' })
    }
  })

  router.patch('/part-supplier-options/:optionId', async (req, res) => {
    const optionId = toInt(req.params.optionId, 0)
    if (!optionId) return res.status(400).json({ ok: false, error: 'Invalid option id.' })

    const body = req.body || {}
    const supplierId = body.supplier_id != null ? toInt(body.supplier_id, null) : null
    const brand = body.brand != null ? normaliseOperationalText(body.brand) : null
    const partNumber = body.part_number != null ? normaliseOperationalText(body.part_number) : null
    const etaText = body.eta_text != null ? normaliseOperationalText(body.eta_text) : null
    const costPrice = body.cost_price != null && body.cost_price !== '' ? roundMoney(body.cost_price) : null
    const markupPercent =
      body.markup_percent != null && body.markup_percent !== ''
        ? toDecimal(body.markup_percent, null)
        : null
    const sellPrice = body.sell_price != null && body.sell_price !== '' ? roundMoney(body.sell_price) : null
    const vatRate = body.vat_rate != null && body.vat_rate !== '' ? toDecimal(body.vat_rate, null) : null
    const isAvailable =
      body.is_available == null ? null : body.is_available === 0 || body.is_available === false ? 0 : 1
    const isOrdered =
      body.is_ordered == null ? null : body.is_ordered === 1 || body.is_ordered === true ? 1 : 0

    try {
      const out = await db.transaction(async (tx) => {
        const option = await tx.get(`SELECT * FROM part_supplier_options WHERE id = ?`, [optionId])
        if (!option) {
          const err = new Error('Supplier option not found.')
          err.status = 404
          throw err
        }

        if (isAvailable === 0 && Number(option.is_selected) === 1) {
          const err = new Error('Cannot mark the selected supplier option as not available. Select another option first.')
          err.status = 400
          throw err
        }

        if (supplierId != null) {
          const supplier = await tx.get(`SELECT id FROM suppliers WHERE id = ?`, [supplierId])
          if (!supplier) {
            const err = new Error('Supplier not found.')
            err.status = 400
            throw err
          }
        }

        await tx.run(
          `
          UPDATE part_supplier_options
          SET
            supplier_id = COALESCE(?, supplier_id),
            brand = COALESCE(?, brand),
            part_number = COALESCE(?, part_number),
            cost_price = COALESCE(?, cost_price),
            markup_percent = COALESCE(?, markup_percent),
            sell_price = COALESCE(?, sell_price),
            vat_rate = COALESCE(?, vat_rate),
            eta_text = COALESCE(?, eta_text),
            is_available = COALESCE(?, is_available),
            is_ordered = COALESCE(?, is_ordered),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [
            supplierId,
            brand,
            partNumber,
            costPrice,
            markupPercent,
            sellPrice,
            vatRate,
            etaText,
            isAvailable,
            isOrdered,
            optionId,
          ],
        )

        const updatedOption = await tx.get(
          `SELECT pso.*, s.name AS supplier_name
           FROM part_supplier_options pso
           JOIN suppliers s ON s.id = pso.supplier_id
           WHERE pso.id = ?`,
          [optionId],
        )

        // If this option is selected, keep the parent quote item in sync.
        let updatedItem = null
        let updatedTotals = null
        if (Number(updatedOption && updatedOption.is_selected) === 1) {
          const item = await tx.get(`SELECT * FROM quote_items WHERE id = ?`, [updatedOption.quote_item_id])
          if (item) {
            const totals = computeItemTotals(item.quantity, updatedOption.cost_price, updatedOption.sell_price)
            await tx.run(
              `
              UPDATE quote_items
              SET
                supplier_id = ?,
                part_brand = ?,
                part_number = ?,
                unit_cost = ?,
                unit_sell = ?,
                markup_percent = ?,
                vat_rate = ?,
                eta_text = ?,
                total_cost = ?,
                total_sell = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
              [
                updatedOption.supplier_id,
                updatedOption.brand || item.part_brand,
                updatedOption.part_number || item.part_number,
                totals.unit_cost,
                totals.unit_sell,
                updatedOption.markup_percent != null
                  ? updatedOption.markup_percent
                  : item.markup_percent,
                updatedOption.vat_rate != null ? updatedOption.vat_rate : item.vat_rate,
                updatedOption.eta_text != null ? updatedOption.eta_text : item.eta_text,
                totals.total_cost,
                totals.total_sell,
                item.id,
              ],
            )
            updatedTotals = await recalculateQuote(tx, item.quote_id)
            updatedItem = await tx.get(`SELECT * FROM quote_items WHERE id = ?`, [item.id])
          }
        }

        return { option: updatedOption, item: updatedItem, totals: updatedTotals }
      })

      res.json({ ok: true, option: out.option, item: out.item, totals: out.totals })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to update supplier option.' })
    }
  })

  return router
}

module.exports = {
  createQuotesRouter,
}
