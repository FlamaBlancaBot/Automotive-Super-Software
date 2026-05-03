'use strict'

const express = require('express')

function toInt(value, fallback = 50) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function createActivityRouter({ db }) {
  const router = express.Router()

  router.get('/activity', async (req, res) => {
    const entityType = String(req.query.entity_type || '').trim().toLowerCase()
    const entityId = String(req.query.entity_id || '').trim()
    const limit = Math.max(1, Math.min(300, toInt(req.query.limit, 80)))
    const where = []
    const params = []

    if (entityType) {
      where.push(`a.entity_type = ?`)
      params.push(entityType)
    }
    if (entityId) {
      where.push(`a.entity_id = ?`)
      params.push(Number(entityId) || 0)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    try {
      const rows = await db.all(
        `
        SELECT
          a.id,
          a.entity_type,
          a.entity_id,
          a.action,
          a.summary,
          a.metadata_json,
          a.created_at,
          u.name AS user_name
        FROM activity_logs a
        LEFT JOIN users u ON u.id = a.user_id
        ${whereSql}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${limit}
      `,
        params,
      )
      res.json({ ok: true, activity: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load activity.' })
    }
  })

  return router
}

module.exports = {
  createActivityRouter,
}

