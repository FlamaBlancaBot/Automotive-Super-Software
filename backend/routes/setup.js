'use strict'

const express = require('express')
const { getSetupStatus, initDatabase } = require('../db/setup-logic')
const { seedDatabase } = require('../db/seed-logic')

function requireSetupToken(req, res, next) {
  const expected = process.env.SETUP_TOKEN
  if (!expected) {
    return res.status(503).json({
      ok: false,
      error: 'Setup endpoints are disabled. Set SETUP_TOKEN in environment variables.',
    })
  }

  const provided = req.header('X-Setup-Token')
  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'Invalid setup token.' })
  }

  next()
}

function createSetupRouter({ db }) {
  const router = express.Router()

  router.get('/setup/status', requireSetupToken, async (req, res) => {
    try {
      const status = await getSetupStatus(db)
      let warnings = []
      const usersInfo = status?.tables?.users
      if (usersInfo?.exists && Number(usersInfo.count || 0) === 0) {
        const hasDefaults =
          Boolean(String(process.env.DEFAULT_ADMIN_EMAIL || '').trim()) &&
          Boolean(String(process.env.DEFAULT_ADMIN_PASSWORD || '').trim())
        if (!hasDefaults) {
          warnings.push(
            'No users found. Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD, then run seed.',
          )
        }
      }
      res.json({
        ok: true,
        app: 'Automotive Super Software',
        environment: process.env.NODE_ENV || 'development',
        database: { client: 'mysql' },
        time: new Date().toISOString(),
        warnings,
        ...status,
      })
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: 'Failed to check setup status.',
        details: String(err && err.message ? err.message : err),
        hint:
          'Check Hostinger environment variables (DB_* and SETUP_TOKEN), and confirm the database exists and is reachable.',
      })
    }
  })

  router.post('/setup/init', requireSetupToken, async (req, res) => {
    try {
      await initDatabase(db)
      const status = await getSetupStatus(db)
      res.json({ ok: true, message: 'Database tables checked/created.', ...status })
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: 'Failed to initialise database tables.',
        details: String(err && err.message ? err.message : err),
      })
    }
  })

  router.post('/setup/seed', requireSetupToken, async (req, res) => {
    try {
      const statusBefore = await getSetupStatus(db)
      const missing = Object.entries(statusBefore.tables || {})
        .filter(([, info]) => !info.exists)
        .map(([name]) => name)

      if (missing.length) {
        return res.status(400).json({
          ok: false,
          error: `Database tables are missing: ${missing.join(', ')}. Run init first.`,
        })
      }

      const seedResult = await seedDatabase(db)
      const status = await getSetupStatus(db)
      res.json({
        ok: true,
        message: 'Seed complete (testing/demo data only).',
        seed: seedResult.inserted || null,
        ...status,
      })
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: 'Failed to seed database.',
        details: String(err && err.message ? err.message : err),
      })
    }
  })

  return router
}

module.exports = {
  createSetupRouter,
}
