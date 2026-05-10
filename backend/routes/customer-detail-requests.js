'use strict'

const crypto = require('crypto')
const express = require('express')

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex')
}

function makeRawToken() {
  return crypto.randomBytes(24).toString('hex')
}

function createCustomerDetailRequestsRouter({ db }) {
  const router = express.Router()

  router.post('/customer-detail-requests', async (req, res) => {
    if (!req.authUser) {
      return res.status(401).json({ ok: false, error: 'Login required.' })
    }
    const body = req.body || {}
    const customerId = body.customer_id ? Number(body.customer_id) : null
    const jobId = body.job_id ? Number(body.job_id) : null
    const quoteId = body.quote_id ? Number(body.quote_id) : null
    const baseUrl = String(body.base_url || '').trim()

    try {
      const rawToken = makeRawToken()
      const tokenHash = hashToken(rawToken)
      const preview = `${rawToken.slice(0, 6)}...${rawToken.slice(-4)}`
      const expiresHours = 72
      const requestedFields = Array.isArray(body.requested_fields)
        ? body.requested_fields
        : ['email', 'postcode', 'address']

      const created = await db.run(
        `INSERT INTO customer_detail_requests (
          customer_id, job_id, quote_id, token_hash, token_preview,
          status, requested_fields_json, expires_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
        [
          customerId,
          jobId,
          quoteId,
          tokenHash,
          preview,
          JSON.stringify(requestedFields),
          expiresHours,
        ],
      )

      const path = `/customer-details/${rawToken}`
      const previewUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path

      const preferredChannel = body.channel === 'sms' ? 'sms' : 'whatsapp_manual'
      const messageBody = `Customer details request link: ${previewUrl}`
      try {
        const msg = await db.run(
          `INSERT INTO communication_messages (
            customer_id, job_id, quote_id, channel, direction, purpose,
            recipient_name, recipient_phone, recipient_email, body, status
          ) VALUES (?, ?, ?, ?, 'outbound', 'customer_details_request', ?, ?, ?, ?, 'manual_required')`,
          [
            customerId,
            jobId,
            quoteId,
            preferredChannel,
            body.recipient_name ? String(body.recipient_name).trim() : null,
            body.recipient_phone ? String(body.recipient_phone).trim() : null,
            body.recipient_email ? String(body.recipient_email).trim() : null,
            messageBody,
          ],
        )
        await db.run(
          `INSERT INTO communication_events (message_id, event_type, description)
           VALUES (?, 'created', 'Customer details request communication record created.')`,
          [msg.lastInsertId],
        )
      } catch {
        // Keep customer detail request creation resilient if communications tables are not available yet.
      }

      res.status(201).json({
        ok: true,
        request_id: created.lastInsertId,
        preview_url: previewUrl,
        token_preview: preview,
        expires_hours: expiresHours,
        note: 'SMS provider integration will be connected later.',
      })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create customer details request.' })
    }
  })

  router.get('/customer-detail-requests/:token', async (req, res) => {
    const token = String(req.params.token || '').trim()
    if (!token) return res.status(400).json({ ok: false, error: 'Invalid request token.' })
    try {
      const row = await db.get(
        `SELECT id, customer_id, job_id, quote_id, status, requested_fields_json, expires_at
         FROM customer_detail_requests
         WHERE token_hash = ?
         LIMIT 1`,
        [hashToken(token)],
      )
      if (!row) return res.status(404).json({ ok: false, error: 'Request not found.' })
      if (String(row.status) === 'completed') {
        return res.json({ ok: true, request: { ...row, completed: true } })
      }
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ ok: false, error: 'This request link has expired.' })
      }

      let customer = null
      if (row.customer_id) {
        customer = await db.get(
          `SELECT id, first_name, surname FROM customers WHERE id = ? LIMIT 1`,
          [row.customer_id],
        )
      }

      res.json({
        ok: true,
        request: {
          id: row.id,
          status: row.status,
          expires_at: row.expires_at,
          requested_fields: row.requested_fields_json
            ? JSON.parse(row.requested_fields_json)
            : ['email', 'postcode', 'address'],
          customer_name: customer ? `${customer.first_name} ${customer.surname}` : null,
        },
      })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load customer details request.' })
    }
  })

  router.post('/customer-detail-requests/:token/submit', async (req, res) => {
    const token = String(req.params.token || '').trim()
    const body = req.body || {}
    if (!token) return res.status(400).json({ ok: false, error: 'Invalid request token.' })

    const email = String(body.email || '').trim()
    const postcode = String(body.postcode || '').trim().toUpperCase()
    const address = String(body.address || '').trim()

    try {
      const row = await db.get(
        `SELECT * FROM customer_detail_requests WHERE token_hash = ? LIMIT 1`,
        [hashToken(token)],
      )
      if (!row) return res.status(404).json({ ok: false, error: 'Request not found.' })
      if (new Date(row.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ ok: false, error: 'This request link has expired.' })
      }
      if (String(row.status || '').toLowerCase() === 'completed') {
        return res.status(409).json({ ok: false, error: 'This request has already been completed.' })
      }

      if (row.customer_id) {
        await db.run(
          `UPDATE customers
           SET email = COALESCE(?, email),
               postcode = COALESCE(?, postcode),
               address = COALESCE(?, address),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [email || null, postcode || null, address || null, row.customer_id],
        )
      }

      await db.run(
        `UPDATE customer_detail_requests
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [row.id],
      )
      res.json({ ok: true, message: 'Thank you. Your details were submitted successfully.' })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to submit details.' })
    }
  })

  return router
}

module.exports = {
  createCustomerDetailRequestsRouter,
}
