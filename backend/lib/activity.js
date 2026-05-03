'use strict'

async function logActivity(db, payload = {}) {
  const {
    userId = null,
    entityType = null,
    entityId = null,
    action = null,
    summary = null,
    metadata = null,
  } = payload

  if (!entityType || !action || !summary) return

  await db.run(
    `INSERT INTO activity_logs (user_id, entity_type, entity_id, action, summary, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      String(entityType).trim().toLowerCase(),
      entityId != null ? Number(entityId) || null : null,
      String(action).trim().toLowerCase(),
      String(summary).trim(),
      metadata ? JSON.stringify(metadata) : null,
    ],
  )
}

module.exports = {
  logActivity,
}

