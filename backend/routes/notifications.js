'use strict'

const express = require('express')

function toInt(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

const SEVERITIES = new Set(['info', 'success', 'warning', 'danger'])

function createNotificationsRouter({ db }) {
  const router = express.Router()

  router.get('/notifications', async (req, res) => {
    const limit = Math.max(1, Math.min(200, toInt(req.query.limit, 50) || 50))
    const unreadOnly = String(req.query.unread_only || '').toLowerCase() === 'true'
    const userId = req.authUser ? Number(req.authUser.id) : null

    const where = []
    const params = []
    if (unreadOnly) where.push('n.read_at IS NULL')
    if (userId) {
      where.push('(n.user_id IS NULL OR n.user_id = ?)')
      params.push(userId)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await db.all(
      `SELECT n.* FROM platform_notifications n ${whereSql} ORDER BY n.created_at DESC, n.id DESC LIMIT ${limit}`,
      params,
    ).catch(() => [])

    const unreadRow = await db.get(
      `SELECT COUNT(*) AS count
       FROM platform_notifications n
       WHERE n.read_at IS NULL ${userId ? 'AND (n.user_id IS NULL OR n.user_id = ?)' : ''}`,
      userId ? [userId] : [],
    ).catch(() => ({ count: 0 }))

    res.json({ ok: true, notifications: rows || [], unread_count: Number(unreadRow?.count || 0) })
  })

  router.post('/notifications', async (req, res) => {
    const body = req.body || {}
    const notificationType = String(body.notification_type || '').trim()
    const title = String(body.title || '').trim()
    const message = String(body.message || '').trim()
    const severity = String(body.severity || 'info').trim().toLowerCase()

    if (!notificationType || !title || !message) {
      return res.status(400).json({ ok: false, error: 'notification_type, title and message are required.' })
    }
    if (!SEVERITIES.has(severity)) {
      return res.status(400).json({ ok: false, error: 'Invalid severity.' })
    }

    const created = await db.run(
      `INSERT INTO platform_notifications (
         user_id, notification_type, title, message, severity, related_type, related_id, action_url, sound_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.user_id ? toInt(body.user_id, null) : null,
        notificationType,
        title,
        message,
        severity,
        body.related_type ? String(body.related_type).trim() : null,
        body.related_id != null ? toInt(body.related_id, null) : null,
        body.action_url ? String(body.action_url).trim() : null,
        body.sound_key ? String(body.sound_key).trim() : null,
      ],
    )

    const row = await db.get(`SELECT * FROM platform_notifications WHERE id = ?`, [created.lastInsertId])
    res.status(201).json({ ok: true, notification: row })
  })

  router.patch('/notifications/:id/read', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid notification id.' })

    await db.run(
      `UPDATE platform_notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = ?`,
      [id],
    )

    const row = await db.get(`SELECT * FROM platform_notifications WHERE id = ?`, [id])
    if (!row) return res.status(404).json({ ok: false, error: 'Notification not found.' })
    res.json({ ok: true, notification: row })
  })

  router.post('/notifications/mark-all-read', async (req, res) => {
    const userId = req.authUser ? Number(req.authUser.id) : null
    const result = await db.run(
      `UPDATE platform_notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE read_at IS NULL ${userId ? 'AND (user_id IS NULL OR user_id = ?)' : ''}`,
      userId ? [userId] : [],
    )
    res.json({ ok: true, updated: Number(result?.changes || 0) })
  })

  return router
}

module.exports = {
  createNotificationsRouter,
}
