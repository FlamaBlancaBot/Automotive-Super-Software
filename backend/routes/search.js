'use strict'

const express = require('express')

function createSearchRouter({ db }) {
  const router = express.Router()

  router.get('/search', async (req, res) => {
    const q = String(req.query.q || '').trim()
    if (!q) return res.status(400).json({ ok: false, error: 'q is required.' })

    const like = `%${q}%`
    const qNoSpaces = q.replace(/\s+/g, '')
    const likeNoSpaces = `%${qNoSpaces}%`

    try {
      const [vehicles, customers, jobs, quotes, partsOrders] = await Promise.all([
        db.all(
          `
          SELECT id, registration, make, model, year, mot_status, mot_expiry
          FROM vehicles
          WHERE registration LIKE ?
             OR UPPER(REPLACE(registration, ' ', '')) LIKE UPPER(?)
          ORDER BY updated_at DESC, id DESC
          LIMIT 20
        `,
          [like, likeNoSpaces],
        ),
        db.all(
          `
          SELECT id, first_name, surname, phone
          FROM customers
          WHERE first_name LIKE ?
             OR surname LIKE ?
             OR phone LIKE ?
          ORDER BY updated_at DESC, id DESC
          LIMIT 20
        `,
          [like, like, like],
        ),
        db.all(
          `
          SELECT
            j.id,
            j.status,
            j.priority,
            j.title,
            j.booked_start,
            j.booked_end,
            v.registration AS vehicle_registration,
            v.make AS vehicle_make,
            v.model AS vehicle_model,
            c.first_name AS customer_first_name,
            c.surname AS customer_surname
          FROM jobs j
          JOIN vehicles v ON v.id = j.vehicle_id
          JOIN customers c ON c.id = j.customer_id
          WHERE v.registration LIKE ?
             OR UPPER(REPLACE(v.registration, ' ', '')) LIKE UPPER(?)
             OR c.first_name LIKE ?
             OR c.surname LIKE ?
             OR c.phone LIKE ?
             OR j.title LIKE ?
          ORDER BY COALESCE(j.booked_start, CONCAT(j.requested_date, ' 00:00:00')) DESC, j.id DESC
          LIMIT 30
        `,
          [like, likeNoSpaces, like, like, like, like],
        ),
        db.all(
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
          WHERE q.quote_number LIKE ?
             OR q.title LIKE ?
             OR v.registration LIKE ?
             OR UPPER(REPLACE(v.registration, ' ', '')) LIKE UPPER(?)
             OR c.first_name LIKE ?
             OR c.surname LIKE ?
          ORDER BY q.updated_at DESC, q.id DESC
          LIMIT 30
        `,
          [like, like, like, likeNoSpaces, like, like],
        ),
        db.all(
          `
          SELECT
            po.id,
            po.status,
            po.part_name,
            po.brand,
            po.part_number,
            po.quantity,
            po.eta_text,
            po.expected_at,
            po.eta_datetime,
            v.registration AS vehicle_registration,
            q.quote_number,
            s.name AS supplier_name
          FROM parts_orders po
          LEFT JOIN jobs j ON j.id = po.job_id
          LEFT JOIN vehicles v ON v.id = COALESCE(po.vehicle_id, j.vehicle_id)
          LEFT JOIN quotes q ON q.id = po.quote_id
          LEFT JOIN suppliers s ON s.id = po.supplier_id
          WHERE po.part_name LIKE ?
             OR po.description LIKE ?
             OR po.brand LIKE ?
             OR po.part_number LIKE ?
             OR v.registration LIKE ?
             OR UPPER(REPLACE(v.registration, ' ', '')) LIKE UPPER(?)
             OR q.quote_number LIKE ?
             OR s.name LIKE ?
          ORDER BY po.updated_at DESC, po.id DESC
          LIMIT 30
        `,
          [like, like, like, like, like, likeNoSpaces, like, like],
        ),
      ])

      res.json({
        ok: true,
        query: q,
        results: {
          vehicles: vehicles || [],
          customers: customers || [],
          jobs: jobs || [],
          quotes: quotes || [],
          parts_orders: partsOrders || [],
        },
      })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Search failed.' })
    }
  })

  return router
}

module.exports = {
  createSearchRouter,
}

