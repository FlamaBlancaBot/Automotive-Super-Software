'use strict'

const express = require('express')

const MOVEMENT_TYPES = new Set([
  'opening_balance',
  'stock_in',
  'stock_out',
  'job_usage',
  'return_to_stock',
  'supplier_return',
  'adjustment',
  'wastage',
])

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toDecimal(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toNullableDecimal(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function truthy(value) {
  const v = String(value || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

function normaliseMovementType(value) {
  const t = String(value || '').trim().toLowerCase()
  return MOVEMENT_TYPES.has(t) ? t : ''
}

function applyMovementToStock(currentQty, movementType, quantity) {
  const current = toDecimal(currentQty, 0)
  const qty = Math.abs(toDecimal(quantity, 0))

  if (movementType === 'opening_balance') return qty
  if (movementType === 'stock_in' || movementType === 'return_to_stock') return current + qty
  if (movementType === 'stock_out' || movementType === 'job_usage' || movementType === 'supplier_return' || movementType === 'wastage') {
    return current - qty
  }
  if (movementType === 'adjustment') return current + toDecimal(quantity, 0)
  return current
}

function createInventoryRouter({ db }) {
  const router = express.Router()

  router.get('/inventory/items', async (req, res) => {
    const q = String(req.query.q || '').trim()
    const category = String(req.query.category || '').trim()
    const active = String(req.query.active || '').trim().toLowerCase()
    const lowStockOnly = truthy(req.query.low_stock)

    try {
      const where = []
      const params = []

      if (q) {
        const like = `%${q}%`
        where.push('(i.sku LIKE ? OR i.name LIKE ? OR i.supplier_name LIKE ? OR i.storage_location LIKE ?)')
        params.push(like, like, like, like)
      }
      if (category) {
        where.push('i.category = ?')
        params.push(category)
      }
      if (active === 'true' || active === 'false') {
        where.push('i.active = ?')
        params.push(active === 'true' ? 1 : 0)
      }
      if (lowStockOnly) where.push('i.quantity_on_hand <= i.reorder_point')

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const rows = await db.all(
        `SELECT
          i.*,
          (i.quantity_on_hand <= i.reorder_point) AS is_low_stock,
          (i.expiry_date IS NOT NULL AND i.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS is_expiring_soon,
          (SELECT MAX(m.created_at) FROM inventory_stock_movements m WHERE m.inventory_item_id = i.id) AS last_movement_at
         FROM inventory_items i
         ${whereSql}
         ORDER BY i.active DESC, i.name ASC, i.id DESC
         LIMIT 1000`,
        params,
      )

      res.json({ ok: true, items: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load inventory items.' })
    }
  })

  router.post('/inventory/items', async (req, res) => {
    const body = req.body || {}
    const name = String(body.name || '').trim()
    if (!name) return res.status(400).json({ ok: false, error: 'Inventory item name is required.' })

    try {
      const created = await db.run(
        `INSERT INTO inventory_items (
          sku, name, category, description, supplier_name, supplier_part_number,
          unit_cost, sell_price, quantity_on_hand, reorder_point, reorder_quantity,
          unit_of_measure, storage_location, expiry_date, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.sku ? String(body.sku).trim() : null,
          name,
          body.category ? String(body.category).trim() : null,
          body.description ? String(body.description).trim() : null,
          body.supplier_name ? String(body.supplier_name).trim() : null,
          body.supplier_part_number ? String(body.supplier_part_number).trim() : null,
          toNullableDecimal(body.unit_cost),
          toNullableDecimal(body.sell_price),
          toDecimal(body.quantity_on_hand, 0),
          toDecimal(body.reorder_point, 0),
          toNullableDecimal(body.reorder_quantity),
          body.unit_of_measure ? String(body.unit_of_measure).trim() : 'unit',
          body.storage_location ? String(body.storage_location).trim() : null,
          body.expiry_date ? String(body.expiry_date).slice(0, 10) : null,
          body.active === 0 || body.active === false ? 0 : 1,
        ],
      )

      const item = await db.get(`SELECT * FROM inventory_items WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, item })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create inventory item.' })
    }
  })

  router.get('/inventory/items/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid inventory item id.' })

    try {
      const item = await db.get(`SELECT * FROM inventory_items WHERE id = ?`, [id])
      if (!item) return res.status(404).json({ ok: false, error: 'Inventory item not found.' })
      res.json({ ok: true, item })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load inventory item.' })
    }
  })

  router.patch('/inventory/items/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid inventory item id.' })

    const body = req.body || {}
    if (body.name != null && !String(body.name).trim()) {
      return res.status(400).json({ ok: false, error: 'Inventory item name cannot be empty.' })
    }

    try {
      const updated = await db.transaction(async (tx) => {
        const row = await tx.get(`SELECT * FROM inventory_items WHERE id = ?`, [id])
        if (!row) {
          const err = new Error('Inventory item not found.')
          err.status = 404
          throw err
        }

        const next = {
          sku: body.sku != null ? String(body.sku).trim() || null : row.sku,
          name: body.name != null ? String(body.name).trim() : row.name,
          category: body.category != null ? String(body.category).trim() || null : row.category,
          description: body.description != null ? String(body.description).trim() || null : row.description,
          supplier_name: body.supplier_name != null ? String(body.supplier_name).trim() || null : row.supplier_name,
          supplier_part_number: body.supplier_part_number != null ? String(body.supplier_part_number).trim() || null : row.supplier_part_number,
          unit_cost: body.unit_cost != null ? toNullableDecimal(body.unit_cost) : row.unit_cost,
          sell_price: body.sell_price != null ? toNullableDecimal(body.sell_price) : row.sell_price,
          quantity_on_hand: body.quantity_on_hand != null ? toDecimal(body.quantity_on_hand, 0) : row.quantity_on_hand,
          reorder_point: body.reorder_point != null ? toDecimal(body.reorder_point, 0) : row.reorder_point,
          reorder_quantity: body.reorder_quantity != null ? toNullableDecimal(body.reorder_quantity) : row.reorder_quantity,
          unit_of_measure: body.unit_of_measure != null ? String(body.unit_of_measure).trim() || 'unit' : row.unit_of_measure,
          storage_location: body.storage_location != null ? String(body.storage_location).trim() || null : row.storage_location,
          expiry_date: body.expiry_date != null ? (body.expiry_date ? String(body.expiry_date).slice(0, 10) : null) : row.expiry_date,
          active: body.active != null ? (body.active === 0 || body.active === false ? 0 : 1) : row.active,
        }

        await tx.run(
          `UPDATE inventory_items
           SET sku=?, name=?, category=?, description=?, supplier_name=?, supplier_part_number=?,
               unit_cost=?, sell_price=?, quantity_on_hand=?, reorder_point=?, reorder_quantity=?,
               unit_of_measure=?, storage_location=?, expiry_date=?, active=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
          [
            next.sku,
            next.name,
            next.category,
            next.description,
            next.supplier_name,
            next.supplier_part_number,
            next.unit_cost,
            next.sell_price,
            next.quantity_on_hand,
            next.reorder_point,
            next.reorder_quantity,
            next.unit_of_measure,
            next.storage_location,
            next.expiry_date,
            next.active,
            id,
          ],
        )

        return tx.get(`SELECT * FROM inventory_items WHERE id = ?`, [id])
      })

      res.json({ ok: true, item: updated })
    } catch (err) {
      if (err && err.status === 404) return res.status(404).json({ ok: false, error: err.message })
      res.status(500).json({ ok: false, error: 'Failed to update inventory item.' })
    }
  })

  router.get('/inventory/items/:id/movements', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid inventory item id.' })

    try {
      const rows = await db.all(
        `SELECT m.*, i.name AS inventory_item_name
         FROM inventory_stock_movements m
         JOIN inventory_items i ON i.id = m.inventory_item_id
         WHERE m.inventory_item_id = ?
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 500`,
        [id],
      )
      res.json({ ok: true, movements: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load stock movements.' })
    }
  })

  async function createMovement(tx, payload) {
    const item = await tx.get(`SELECT * FROM inventory_items WHERE id = ?`, [payload.inventory_item_id])
    if (!item) {
      const err = new Error('Inventory item not found.')
      err.status = 404
      throw err
    }

    const movementType = normaliseMovementType(payload.movement_type)
    if (!movementType) {
      const err = new Error('Invalid movement type.')
      err.status = 400
      throw err
    }

    const quantityNumber = Number(payload.quantity)
    if (!Number.isFinite(quantityNumber)) {
      const err = new Error('Movement quantity must be numeric.')
      err.status = 400
      throw err
    }

    const nextQty = applyMovementToStock(item.quantity_on_hand, movementType, quantityNumber)
    if (nextQty < 0) {
      const err = new Error('Insufficient stock. Movement would make stock negative.')
      err.status = 409
      throw err
    }

    const signedQuantity = movementType === 'adjustment' ? toDecimal(quantityNumber, 0) : Math.abs(toDecimal(quantityNumber, 0))

    const movement = await tx.run(
      `INSERT INTO inventory_stock_movements (
        inventory_item_id, job_id, quote_id, parts_order_id, movement_type, quantity,
        unit_cost, notes, reference, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        payload.job_id || null,
        payload.quote_id || null,
        payload.parts_order_id || null,
        movementType,
        signedQuantity,
        payload.unit_cost != null ? toNullableDecimal(payload.unit_cost) : null,
        payload.notes ? String(payload.notes).trim() : null,
        payload.reference ? String(payload.reference).trim() : null,
        payload.created_by ? String(payload.created_by).trim() : null,
      ],
    )

    await tx.run(
      `UPDATE inventory_items
       SET quantity_on_hand = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextQty, item.id],
    )

    const movementRow = await tx.get(`SELECT * FROM inventory_stock_movements WHERE id = ?`, [movement.lastInsertId])
    const itemRow = await tx.get(`SELECT * FROM inventory_items WHERE id = ?`, [item.id])
    return { movement: movementRow, item: itemRow }
  }

  router.post('/inventory/items/:id/movements', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid inventory item id.' })

    try {
      const out = await db.transaction((tx) => createMovement(tx, { ...(req.body || {}), inventory_item_id: id }))
      res.status(201).json({ ok: true, ...out })
    } catch (err) {
      const status = Number(err && err.status) || 500
      const message = status >= 500 ? 'Failed to record stock movement.' : String(err.message || 'Invalid movement request.')
      res.status(status).json({ ok: false, error: message })
    }
  })

  router.post('/jobs/:id/inventory-usage', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })

    const body = req.body || {}
    const inventoryItemId = toInt(body.inventory_item_id, 0)
    if (!inventoryItemId) return res.status(400).json({ ok: false, error: 'inventory_item_id is required.' })

    try {
      const out = await db.transaction(async (tx) => {
        const job = await tx.get(`SELECT id FROM jobs WHERE id = ?`, [jobId])
        if (!job) {
          const err = new Error('Job not found.')
          err.status = 404
          throw err
        }
        return createMovement(tx, {
          inventory_item_id: inventoryItemId,
          job_id: jobId,
          quote_id: body.quote_id ? toInt(body.quote_id, null) : null,
          parts_order_id: body.parts_order_id ? toInt(body.parts_order_id, null) : null,
          movement_type: 'job_usage',
          quantity: body.quantity,
          unit_cost: body.unit_cost,
          reference: body.reference,
          notes: body.notes,
          created_by: body.created_by,
        })
      })
      res.status(201).json({ ok: true, ...out })
    } catch (err) {
      const status = Number(err && err.status) || 500
      const message = status >= 500 ? 'Failed to record inventory usage.' : String(err.message || 'Invalid usage request.')
      res.status(status).json({ ok: false, error: message })
    }
  })

  router.get('/inventory/low-stock', async (_req, res) => {
    try {
      const rows = await db.all(
        `SELECT * FROM inventory_items
         WHERE active = 1 AND quantity_on_hand <= reorder_point
         ORDER BY (reorder_point - quantity_on_hand) DESC, name ASC`,
      )
      res.json({ ok: true, items: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load low stock items.' })
    }
  })

  router.get('/inventory/expiring', async (req, res) => {
    const days = Math.max(1, Math.min(365, toInt(req.query.days, 30) || 30))
    try {
      const rows = await db.all(
        `SELECT * FROM inventory_items
         WHERE active = 1 AND expiry_date IS NOT NULL
           AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         ORDER BY expiry_date ASC, name ASC`,
        [days],
      )
      res.json({ ok: true, days, items: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load expiring items.' })
    }
  })

  router.get('/inventory/summary', async (_req, res) => {
    try {
      const totals = await db.get(
        `SELECT
           COUNT(*) AS total_items,
           SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_items,
           SUM(CASE WHEN active = 1 AND quantity_on_hand <= reorder_point THEN 1 ELSE 0 END) AS low_stock_items,
           SUM(CASE WHEN active = 1 AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS expiring_soon_items,
           COALESCE(SUM(CASE WHEN unit_cost IS NOT NULL THEN quantity_on_hand * unit_cost ELSE 0 END), 0) AS stock_value
         FROM inventory_items`,
      )

      const monthMovements = await db.get(
        `SELECT COUNT(*) AS movements_this_month
         FROM inventory_stock_movements
         WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      )

      const mostUsed = await db.all(
        `SELECT i.id, i.name, COALESCE(SUM(m.quantity), 0) AS qty_used
         FROM inventory_stock_movements m
         JOIN inventory_items i ON i.id = m.inventory_item_id
         WHERE m.movement_type = 'job_usage'
           AND m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY i.id, i.name
         ORDER BY qty_used DESC
         LIMIT 5`,
      )

      res.json({
        ok: true,
        summary: {
          total_items: Number(totals?.total_items || 0),
          active_items: Number(totals?.active_items || 0),
          low_stock_items: Number(totals?.low_stock_items || 0),
          expiring_soon_items: Number(totals?.expiring_soon_items || 0),
          stock_value: Number(totals?.stock_value || 0),
          movements_this_month: Number(monthMovements?.movements_this_month || 0),
        },
        most_used_items: mostUsed || [],
      })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load inventory summary.' })
    }
  })

  router.get('/inventory/items/:id/suppliers', async (req, res) => {
    const itemId = toInt(req.params.id, 0)
    if (!itemId) return res.status(400).json({ ok: false, error: 'Invalid inventory item id.' })

    try {
      const rows = await db.all(
        `SELECT * FROM inventory_item_suppliers
         WHERE inventory_item_id = ?
         ORDER BY preferred DESC, active DESC, supplier_name ASC, id DESC`,
        [itemId],
      )
      res.json({ ok: true, suppliers: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load item suppliers.' })
    }
  })

  router.post('/inventory/items/:id/suppliers', async (req, res) => {
    const itemId = toInt(req.params.id, 0)
    if (!itemId) return res.status(400).json({ ok: false, error: 'Invalid inventory item id.' })

    const body = req.body || {}
    const supplierName = String(body.supplier_name || '').trim()
    if (!supplierName) return res.status(400).json({ ok: false, error: 'supplier_name is required.' })

    try {
      const out = await db.transaction(async (tx) => {
        if (body.preferred === 1 || body.preferred === true) {
          await tx.run(`UPDATE inventory_item_suppliers SET preferred = 0 WHERE inventory_item_id = ?`, [itemId])
        }
        const created = await tx.run(
          `INSERT INTO inventory_item_suppliers (
            inventory_item_id, supplier_name, supplier_part_number, unit_cost, lead_time_days, preferred, active
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            supplierName,
            body.supplier_part_number ? String(body.supplier_part_number).trim() : null,
            toNullableDecimal(body.unit_cost),
            body.lead_time_days != null ? toInt(body.lead_time_days, null) : null,
            body.preferred === 1 || body.preferred === true ? 1 : 0,
            body.active === 0 || body.active === false ? 0 : 1,
          ],
        )
        return tx.get(`SELECT * FROM inventory_item_suppliers WHERE id = ?`, [created.lastInsertId])
      })
      res.status(201).json({ ok: true, supplier: out })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to add item supplier.' })
    }
  })

  router.patch('/inventory/items/:id/suppliers/:supplierId', async (req, res) => {
    const itemId = toInt(req.params.id, 0)
    const supplierId = toInt(req.params.supplierId, 0)
    if (!itemId || !supplierId) return res.status(400).json({ ok: false, error: 'Invalid supplier record id.' })

    const body = req.body || {}
    try {
      const out = await db.transaction(async (tx) => {
        const row = await tx.get(
          `SELECT * FROM inventory_item_suppliers WHERE id = ? AND inventory_item_id = ?`,
          [supplierId, itemId],
        )
        if (!row) {
          const err = new Error('Supplier record not found.')
          err.status = 404
          throw err
        }

        const nextPreferred = body.preferred != null ? (body.preferred === 1 || body.preferred === true ? 1 : 0) : row.preferred
        if (nextPreferred === 1) {
          await tx.run(`UPDATE inventory_item_suppliers SET preferred = 0 WHERE inventory_item_id = ?`, [itemId])
        }

        await tx.run(
          `UPDATE inventory_item_suppliers
           SET supplier_name=?, supplier_part_number=?, unit_cost=?, lead_time_days=?, preferred=?, active=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=? AND inventory_item_id=?`,
          [
            body.supplier_name != null ? String(body.supplier_name).trim() || row.supplier_name : row.supplier_name,
            body.supplier_part_number != null ? String(body.supplier_part_number).trim() || null : row.supplier_part_number,
            body.unit_cost != null ? toNullableDecimal(body.unit_cost) : row.unit_cost,
            body.lead_time_days != null ? toInt(body.lead_time_days, null) : row.lead_time_days,
            nextPreferred,
            body.active != null ? (body.active === 0 || body.active === false ? 0 : 1) : row.active,
            supplierId,
            itemId,
          ],
        )

        return tx.get(`SELECT * FROM inventory_item_suppliers WHERE id = ?`, [supplierId])
      })

      res.json({ ok: true, supplier: out })
    } catch (err) {
      if (err && err.status === 404) return res.status(404).json({ ok: false, error: err.message })
      res.status(500).json({ ok: false, error: 'Failed to update item supplier.' })
    }
  })

  return router
}

module.exports = {
  createInventoryRouter,
}
