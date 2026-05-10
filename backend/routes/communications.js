'use strict'

const express = require('express')

const CHANNELS = new Set(['sms', 'email', 'whatsapp_manual', 'phone_call', 'internal_note'])
const PURPOSES = new Set([
  'quote_approval',
  'job_status_update',
  'appointment_reminder',
  'ready_to_collect',
  'payment_confirmation',
  'invoice_reminder',
  'customer_details_request',
  'general',
])
const STATUSES = new Set(['draft', 'manual_required', 'queued', 'sent', 'failed', 'cancelled'])
const DIRECTIONS = new Set(['outbound', 'inbound', 'internal'])

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toText(value) {
  if (value == null) return ''
  return String(value).trim()
}

function parseNullableId(value) {
  if (value == null || value === '') return null
  const n = toInt(value, 0)
  return n > 0 ? n : null
}

function requiresManual(channel, direction) {
  return direction === 'outbound' && (channel === 'sms' || channel === 'email')
}

async function logMessageEvent(db, messageId, eventType, description = null, metadata = null) {
  await db.run(
    `INSERT INTO communication_events (message_id, event_type, description, metadata_json)
     VALUES (?, ?, ?, ?)`,
    [messageId, eventType, description, metadata ? JSON.stringify(metadata) : null],
  )
}

function createCommunicationsRouter({ db }) {
  const router = express.Router()

  router.get('/communications/messages', async (req, res) => {
    const customerId = parseNullableId(req.query.customer_id)
    const jobId = parseNullableId(req.query.job_id)
    const quoteId = parseNullableId(req.query.quote_id)
    const invoiceId = parseNullableId(req.query.invoice_id)
    const channel = toText(req.query.channel).toLowerCase()
    const purpose = toText(req.query.purpose).toLowerCase()
    const status = toText(req.query.status).toLowerCase()

    const where = []
    const params = []

    if (customerId) {
      where.push('m.customer_id = ?')
      params.push(customerId)
    }
    if (jobId) {
      where.push('m.job_id = ?')
      params.push(jobId)
    }
    if (quoteId) {
      where.push('m.quote_id = ?')
      params.push(quoteId)
    }
    if (invoiceId) {
      where.push('m.invoice_id = ?')
      params.push(invoiceId)
    }
    if (channel && CHANNELS.has(channel)) {
      where.push('m.channel = ?')
      params.push(channel)
    }
    if (purpose && PURPOSES.has(purpose)) {
      where.push('m.purpose = ?')
      params.push(purpose)
    }
    if (status && STATUSES.has(status)) {
      where.push('m.status = ?')
      params.push(status)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    try {
      const rows = await db.all(
        `SELECT
          m.*, c.first_name AS customer_first_name, c.surname AS customer_surname,
          j.title AS job_title, q.quote_number, i.invoice_number
         FROM communication_messages m
         LEFT JOIN customers c ON c.id = m.customer_id
         LEFT JOIN jobs j ON j.id = m.job_id
         LEFT JOIN quotes q ON q.id = m.quote_id
         LEFT JOIN invoices i ON i.id = m.invoice_id
         ${whereSql}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 300`,
        params,
      )
      res.json({ ok: true, messages: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load communication messages.' })
    }
  })

  router.post('/communications/messages', async (req, res) => {
    const body = req.body || {}
    const channel = toText(body.channel).toLowerCase()
    const direction = toText(body.direction || 'outbound').toLowerCase()
    const purpose = toText(body.purpose || 'general').toLowerCase()
    const subject = body.subject != null ? toText(body.subject) || null : null
    const messageBody = toText(body.body)

    if (!CHANNELS.has(channel)) return res.status(400).json({ ok: false, error: 'Invalid channel.' })
    if (!DIRECTIONS.has(direction)) return res.status(400).json({ ok: false, error: 'Invalid direction.' })
    if (!PURPOSES.has(purpose)) return res.status(400).json({ ok: false, error: 'Invalid purpose.' })
    if (!messageBody) return res.status(400).json({ ok: false, error: 'Message body is required.' })

    if (channel === 'email' && !subject) {
      return res.status(400).json({ ok: false, error: 'Email subject is required.' })
    }

    const customerId = parseNullableId(body.customer_id)
    const jobId = parseNullableId(body.job_id)
    const quoteId = parseNullableId(body.quote_id)
    const invoiceId = parseNullableId(body.invoice_id)

    let nextStatus = toText(body.status).toLowerCase()
    if (!nextStatus) nextStatus = requiresManual(channel, direction) ? 'manual_required' : 'draft'
    if (!STATUSES.has(nextStatus)) {
      return res.status(400).json({ ok: false, error: 'Invalid status.' })
    }

    try {
      const created = await db.run(
        `INSERT INTO communication_messages (
          customer_id, job_id, quote_id, invoice_id,
          channel, direction, purpose,
          recipient_name, recipient_phone, recipient_email,
          subject, body, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerId,
          jobId,
          quoteId,
          invoiceId,
          channel,
          direction,
          purpose,
          body.recipient_name != null ? toText(body.recipient_name) || null : null,
          body.recipient_phone != null ? toText(body.recipient_phone) || null : null,
          body.recipient_email != null ? toText(body.recipient_email) || null : null,
          subject,
          messageBody,
          nextStatus,
        ],
      )

      await logMessageEvent(db, created.lastInsertId, 'created', `Message created with status ${nextStatus}.`)
      const message = await db.get(`SELECT * FROM communication_messages WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, message })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create communication message.' })
    }
  })

  router.patch('/communications/messages/:id', async (req, res) => {
    const messageId = toInt(req.params.id, 0)
    if (!messageId) return res.status(400).json({ ok: false, error: 'Invalid message id.' })

    const body = req.body || {}

    try {
      const row = await db.get(`SELECT * FROM communication_messages WHERE id = ?`, [messageId])
      if (!row) return res.status(404).json({ ok: false, error: 'Message not found.' })

      const next = {
        channel: body.channel != null ? toText(body.channel).toLowerCase() : row.channel,
        direction: body.direction != null ? toText(body.direction).toLowerCase() : row.direction,
        purpose: body.purpose != null ? toText(body.purpose).toLowerCase() : row.purpose,
        recipient_name: body.recipient_name != null ? toText(body.recipient_name) || null : row.recipient_name,
        recipient_phone: body.recipient_phone != null ? toText(body.recipient_phone) || null : row.recipient_phone,
        recipient_email: body.recipient_email != null ? toText(body.recipient_email) || null : row.recipient_email,
        subject: body.subject != null ? toText(body.subject) || null : row.subject,
        body: body.body != null ? toText(body.body) : row.body,
        status: body.status != null ? toText(body.status).toLowerCase() : row.status,
        error_message: body.error_message != null ? toText(body.error_message) || null : row.error_message,
        provider_message_id: body.provider_message_id != null ? toText(body.provider_message_id) || null : row.provider_message_id,
      }

      if (!CHANNELS.has(next.channel)) return res.status(400).json({ ok: false, error: 'Invalid channel.' })
      if (!DIRECTIONS.has(next.direction)) return res.status(400).json({ ok: false, error: 'Invalid direction.' })
      if (!PURPOSES.has(next.purpose)) return res.status(400).json({ ok: false, error: 'Invalid purpose.' })
      if (!STATUSES.has(next.status)) return res.status(400).json({ ok: false, error: 'Invalid status.' })
      if (!toText(next.body)) return res.status(400).json({ ok: false, error: 'Message body is required.' })
      if (next.channel === 'email' && !toText(next.subject)) {
        return res.status(400).json({ ok: false, error: 'Email subject is required.' })
      }

      await db.run(
        `UPDATE communication_messages
         SET channel = ?, direction = ?, purpose = ?, recipient_name = ?, recipient_phone = ?, recipient_email = ?,
             subject = ?, body = ?, status = ?, error_message = ?, provider_message_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          next.channel,
          next.direction,
          next.purpose,
          next.recipient_name,
          next.recipient_phone,
          next.recipient_email,
          next.subject,
          next.body,
          next.status,
          next.error_message,
          next.provider_message_id,
          messageId,
        ],
      )

      await logMessageEvent(db, messageId, 'updated', `Message updated to status ${next.status}.`)
      const message = await db.get(`SELECT * FROM communication_messages WHERE id = ?`, [messageId])
      res.json({ ok: true, message })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update communication message.' })
    }
  })

  router.post('/communications/messages/:id/mark-sent', async (req, res) => {
    const messageId = toInt(req.params.id, 0)
    if (!messageId) return res.status(400).json({ ok: false, error: 'Invalid message id.' })
    try {
      const row = await db.get(`SELECT * FROM communication_messages WHERE id = ?`, [messageId])
      if (!row) return res.status(404).json({ ok: false, error: 'Message not found.' })
      await db.run(
        `UPDATE communication_messages
         SET status = 'sent', sent_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [messageId],
      )
      await logMessageEvent(db, messageId, 'marked_sent', 'Marked as sent manually.')
      const message = await db.get(`SELECT * FROM communication_messages WHERE id = ?`, [messageId])
      res.json({ ok: true, message })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to mark message as sent.' })
    }
  })

  router.post('/communications/messages/:id/mark-failed', async (req, res) => {
    const messageId = toInt(req.params.id, 0)
    if (!messageId) return res.status(400).json({ ok: false, error: 'Invalid message id.' })
    const errorMessage = toText((req.body || {}).error_message) || 'Marked as failed manually.'
    try {
      const row = await db.get(`SELECT * FROM communication_messages WHERE id = ?`, [messageId])
      if (!row) return res.status(404).json({ ok: false, error: 'Message not found.' })
      await db.run(
        `UPDATE communication_messages
         SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [errorMessage, messageId],
      )
      await logMessageEvent(db, messageId, 'marked_failed', errorMessage)
      const message = await db.get(`SELECT * FROM communication_messages WHERE id = ?`, [messageId])
      res.json({ ok: true, message })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to mark message as failed.' })
    }
  })

  router.get('/communications/templates', async (_req, res) => {
    try {
      const rows = await db.all(
        `SELECT id, name, channel, purpose, subject, body, active, created_at, updated_at
         FROM communication_templates
         ORDER BY active DESC, name ASC`,
      )
      res.json({ ok: true, templates: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load communication templates.' })
    }
  })

  router.post('/communications/templates', async (req, res) => {
    const body = req.body || {}
    const name = toText(body.name)
    const channel = toText(body.channel).toLowerCase()
    const purpose = toText(body.purpose || 'general').toLowerCase()
    const subject = body.subject != null ? toText(body.subject) || null : null
    const content = toText(body.body)
    const active = body.active === 0 || body.active === false ? 0 : 1

    if (!name) return res.status(400).json({ ok: false, error: 'Template name is required.' })
    if (!CHANNELS.has(channel)) return res.status(400).json({ ok: false, error: 'Invalid channel.' })
    if (!PURPOSES.has(purpose)) return res.status(400).json({ ok: false, error: 'Invalid purpose.' })
    if (!content) return res.status(400).json({ ok: false, error: 'Template body is required.' })

    try {
      const created = await db.run(
        `INSERT INTO communication_templates (name, channel, purpose, subject, body, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, channel, purpose, subject, content, active],
      )
      const template = await db.get(`SELECT * FROM communication_templates WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, template })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create communication template.' })
    }
  })

  router.patch('/communications/templates/:id', async (req, res) => {
    const templateId = toInt(req.params.id, 0)
    if (!templateId) return res.status(400).json({ ok: false, error: 'Invalid template id.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM communication_templates WHERE id = ?`, [templateId])
      if (!row) return res.status(404).json({ ok: false, error: 'Template not found.' })

      const next = {
        name: body.name != null ? toText(body.name) : row.name,
        channel: body.channel != null ? toText(body.channel).toLowerCase() : row.channel,
        purpose: body.purpose != null ? toText(body.purpose).toLowerCase() : row.purpose,
        subject: body.subject != null ? toText(body.subject) || null : row.subject,
        body: body.body != null ? toText(body.body) : row.body,
        active: body.active != null ? (body.active ? 1 : 0) : row.active,
      }

      if (!next.name) return res.status(400).json({ ok: false, error: 'Template name is required.' })
      if (!CHANNELS.has(next.channel)) return res.status(400).json({ ok: false, error: 'Invalid channel.' })
      if (!PURPOSES.has(next.purpose)) return res.status(400).json({ ok: false, error: 'Invalid purpose.' })
      if (!toText(next.body)) return res.status(400).json({ ok: false, error: 'Template body is required.' })

      await db.run(
        `UPDATE communication_templates
         SET name = ?, channel = ?, purpose = ?, subject = ?, body = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.name, next.channel, next.purpose, next.subject, next.body, next.active, templateId],
      )
      const template = await db.get(`SELECT * FROM communication_templates WHERE id = ?`, [templateId])
      res.json({ ok: true, template })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update communication template.' })
    }
  })

  router.get('/communications/context/job/:jobId', async (req, res) => {
    const jobId = toInt(req.params.jobId, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    try {
      const row = await db.get(
        `SELECT
          j.id AS job_id, j.title AS job_title,
          c.id AS customer_id, c.first_name, c.surname, c.phone, c.email,
          v.registration, v.make, v.model
         FROM jobs j
         JOIN customers c ON c.id = j.customer_id
         JOIN vehicles v ON v.id = j.vehicle_id
         WHERE j.id = ?`,
        [jobId],
      )
      if (!row) return res.status(404).json({ ok: false, error: 'Job not found.' })
      res.json({ ok: true, context: row })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load communication context.' })
    }
  })

  return router
}

module.exports = {
  createCommunicationsRouter,
}
