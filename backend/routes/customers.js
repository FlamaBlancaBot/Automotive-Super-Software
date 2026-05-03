'use strict'

const express = require('express')

function createCustomersRouter({ db }) {
  const router = express.Router()

  router.get('/search', async (req, res) => {
    const qRaw = String(req.query.q || '').trim()
    if (!qRaw) return res.json({ ok: true, customers: [] })

    const q = `%${qRaw}%`
    const qDigits = qRaw.replace(/\D/g, '')

    let rows = []
    try {
      if (qDigits) {
        const qPhone = `%${qDigits}%`
        rows = await db.all(
          `
          SELECT id, first_name, surname, phone, created_at, updated_at
          FROM customers
          WHERE first_name LIKE ?
             OR surname LIKE ?
             OR phone LIKE ?
             OR replace(replace(phone, ' ', ''), '+', '') LIKE ?
          ORDER BY updated_at DESC
          LIMIT 20
        `,
          [q, q, q, qPhone],
        )
      } else {
        rows = await db.all(
          `
          SELECT id, first_name, surname, phone, created_at, updated_at
          FROM customers
          WHERE first_name LIKE ?
             OR surname LIKE ?
          ORDER BY updated_at DESC
          LIMIT 20
        `,
          [q, q],
        )
      }
    } catch (err) {
      return res
        .status(500)
        .json({ ok: false, error: 'Customer search failed.' })
    }

    res.json({ ok: true, customers: rows })
  })

  return router
}

module.exports = {
  createCustomersRouter,
}
