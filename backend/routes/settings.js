'use strict'

const express = require('express')

function toInt(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toBool(value, fallback = false) {
  if (value == null) return fallback
  const v = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return fallback
}

async function getSettingMap(db, prefix = null) {
  const where = prefix ? 'WHERE setting_key LIKE ?' : ''
  const rows = await db.all(
    `SELECT setting_key, setting_value, setting_type, description FROM system_settings ${where} ORDER BY setting_key ASC`,
    prefix ? [`${prefix}%`] : [],
  ).catch(() => [])

  const map = {}
  for (const row of rows || []) {
    const type = String(row.setting_type || 'string').toLowerCase()
    let value = row.setting_value
    if (type === 'number') value = Number(row.setting_value || 0)
    else if (type === 'boolean') value = toBool(row.setting_value, false)
    map[row.setting_key] = { value, type, description: row.description || null }
  }
  return map
}

function createSettingsRouter({ db }) {
  const router = express.Router()

  router.get('/settings/mot', async (_req, res) => {
    const map = await getSettingMap(db, 'mot.')
    res.json({ ok: true, settings: map })
  })

  router.patch('/settings/mot', async (req, res) => {
    const body = req.body || {}
    const updates = [
      ['mot.webhook_url', String(body.webhook_url || '').trim(), 'string'],
      ['mot.first_check_delay_minutes', String(toInt(body.first_check_delay_minutes, 45)), 'number'],
      ['mot.retry_delay_1_minutes', String(toInt(body.retry_delay_1_minutes, 10)), 'number'],
      ['mot.retry_delay_2_minutes', String(toInt(body.retry_delay_2_minutes, 10)), 'number'],
      ['mot.retry_delay_3_minutes', String(toInt(body.retry_delay_3_minutes, 5)), 'number'],
      ['mot.delayed_retry_minutes', String(toInt(body.delayed_retry_minutes, 20)), 'number'],
      ['mot.max_checks_per_mot', String(toInt(body.max_checks_per_mot, 20)), 'number'],
      ['mot.scheduler_enabled', String(Boolean(body.scheduler_enabled)), 'boolean'],
      ['mot.scheduler_interval_seconds', String(toInt(body.scheduler_interval_seconds, 60)), 'number'],
    ]

    await db.transaction(async (tx) => {
      for (const [key, value, type] of updates) {
        if (!key || value == null || value === '') continue
        await tx.run(
          `INSERT INTO system_settings (setting_key, setting_value, setting_type)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type), updated_at = CURRENT_TIMESTAMP`,
          [key, value, type],
        )
      }
    })

    const map = await getSettingMap(db, 'mot.')
    res.json({ ok: true, settings: map })
  })

  router.get('/settings/notifications', async (_req, res) => {
    const settings = await getSettingMap(db)
    res.json({
      ok: true,
      settings: {
        sound_enabled: settings['notifications.sound_enabled'] ? Boolean(settings['notifications.sound_enabled'].value) : true,
        default_reminder_lead_minutes: settings['reminders.default_lead_minutes'] ? Number(settings['reminders.default_lead_minutes'].value) : 30,
        unread_behaviour: settings['notifications.unread_behaviour'] ? String(settings['notifications.unread_behaviour'].value) : 'highlight',
      },
    })
  })

  router.patch('/settings/notifications', async (req, res) => {
    const body = req.body || {}
    await db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO system_settings (setting_key, setting_value, setting_type)
         VALUES ('notifications.sound_enabled', ?, 'boolean')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
        [String(Boolean(body.sound_enabled))],
      )
      await tx.run(
        `INSERT INTO system_settings (setting_key, setting_value, setting_type)
         VALUES ('reminders.default_lead_minutes', ?, 'number')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
        [String(toInt(body.default_reminder_lead_minutes, 30))],
      )
      await tx.run(
        `INSERT INTO system_settings (setting_key, setting_value, setting_type)
         VALUES ('notifications.unread_behaviour', ?, 'string')
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
        [String(body.unread_behaviour || 'highlight')],
      )
    })

    const settings = await getSettingMap(db)
    res.json({
      ok: true,
      settings: {
        sound_enabled: settings['notifications.sound_enabled'] ? Boolean(settings['notifications.sound_enabled'].value) : true,
        default_reminder_lead_minutes: settings['reminders.default_lead_minutes'] ? Number(settings['reminders.default_lead_minutes'].value) : 30,
        unread_behaviour: settings['notifications.unread_behaviour'] ? String(settings['notifications.unread_behaviour'].value) : 'highlight',
      },
    })
  })

  return router
}

module.exports = {
  createSettingsRouter,
  getSettingMap,
}
