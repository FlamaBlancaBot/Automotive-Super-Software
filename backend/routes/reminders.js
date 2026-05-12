'use strict'

const express = require('express')

function toInt(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function createRemindersRouter({ db }) {
  const router = express.Router()

  router.get('/reminders', async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const userId = req.authUser ? Number(req.authUser.id) : null

    const where = []
    const params = []
    if (status) {
      where.push('r.status = ?')
      params.push(status)
    }
    if (userId) {
      where.push('(r.user_id IS NULL OR r.user_id = ?)')
      params.push(userId)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = await db.all(
      `SELECT r.* FROM platform_reminders r ${whereSql} ORDER BY r.due_at ASC, r.id DESC LIMIT 300`,
      params,
    ).catch(() => [])

    res.json({ ok: true, reminders: rows || [] })
  })

  router.post('/reminders', async (req, res) => {
    const body = req.body || {}
    const reminderType = String(body.reminder_type || '').trim()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    const dueAt = body.due_at ? String(body.due_at).trim() : ''

    if (!reminderType || !title || !message || !dueAt) {
      return res.status(400).json({ ok: false, error: 'reminder_type, title, message and due_at are required.' })
    }

    const created = await db.run(
      `INSERT INTO platform_reminders (
         user_id, reminder_type, title, message, due_at, status, related_type, related_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.user_id ? toInt(body.user_id, null) : null,
        reminderType,
        title,
        message,
        dueAt,
        body.status ? String(body.status).trim().toLowerCase() : 'open',
        body.related_type ? String(body.related_type).trim() : null,
        body.related_id != null ? toInt(body.related_id, null) : null,
      ],
    )

    const row = await db.get(`SELECT * FROM platform_reminders WHERE id = ?`, [created.lastInsertId])
    res.status(201).json({ ok: true, reminder: row })
  })

  router.patch('/reminders/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid reminder id.' })

    const body = req.body || {}
    const row = await db.get(`SELECT * FROM platform_reminders WHERE id = ?`, [id])
    if (!row) return res.status(404).json({ ok: false, error: 'Reminder not found.' })

    await db.run(
      `UPDATE platform_reminders
       SET reminder_type = ?, title = ?, message = ?, due_at = ?, status = ?,
           related_type = ?, related_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.reminder_type != null ? String(body.reminder_type).trim() : row.reminder_type,
        body.title != null ? String(body.title).trim() : row.title,
        body.message != null ? String(body.message).trim() : row.message,
        body.due_at != null ? String(body.due_at).trim() : row.due_at,
        body.status != null ? String(body.status).trim().toLowerCase() : row.status,
        body.related_type != null ? String(body.related_type).trim() || null : row.related_type,
        body.related_id != null ? toInt(body.related_id, null) : row.related_id,
        id,
      ],
    )

    const updated = await db.get(`SELECT * FROM platform_reminders WHERE id = ?`, [id])
    res.json({ ok: true, reminder: updated })
  })

  return router
}

module.exports = {
  createRemindersRouter,
}
