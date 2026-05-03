'use strict'

const express = require('express')
const { hashToken, createSessionToken, setSessionCookie, clearSessionCookie, setTestingUserCookie } = require('../lib/auth')

const FALLBACK_TEST_USERS = [
  {
    id: 'test-admin',
    name: 'Admin User',
    email: 'admin@autoss.local',
    role: 'admin',
  },
  {
    id: 'test-office',
    name: 'Office User',
    email: 'office@autoss.local',
    role: 'office',
  },
  {
    id: 'test-technician',
    name: 'Technician User',
    email: 'technician@autoss.local',
    role: 'technician',
  },
]

async function issueSessionForDbUser(db, user, res) {
  const rawToken = createSessionToken()
  const tokenHash = hashToken(rawToken)
  await db.run(
    `INSERT INTO user_sessions (user_id, session_token_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [user.id, tokenHash],
  )
  await db.run(
    `UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [user.id],
  )
  setSessionCookie(res, rawToken)
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  }
}

function issueSessionForTestingUser(user, res) {
  setTestingUserCookie(res, user)
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  }
}

function createAuthRouter({ db }) {
  const router = express.Router()

  router.get('/auth/users', async (_req, res) => {
    try {
      const rows = await db.all(
        `SELECT id, name, email, role
         FROM users
         WHERE active = 1
         ORDER BY role ASC, name ASC, id ASC`,
      )
      if (rows && rows.length) return res.json({ ok: true, users: rows })
      return res.json({ ok: true, users: FALLBACK_TEST_USERS })
    } catch {
      return res.json({ ok: true, users: FALLBACK_TEST_USERS })
    }
  })

  router.post('/auth/select-user', async (req, res) => {
    try {
      const body = req.body || {}
      const role = String(body.role || '').trim().toLowerCase()
      const userIdRaw = body.user_id
      const numericUserId = Number(userIdRaw || 0)

      if (numericUserId) {
        const user = await db.get(
          `SELECT id, name, email, role, active FROM users WHERE id = ? LIMIT 1`,
          [numericUserId],
        )
        if (user && user.active) {
          return res.json(await issueSessionForDbUser(db, user, res))
        }
      }

      const userId = String(userIdRaw || '').trim()
      let fallbackUser = null
      if (userId) {
        fallbackUser = FALLBACK_TEST_USERS.find((u) => u.id === userId) || null
      }
      if (!fallbackUser && role) {
        fallbackUser = FALLBACK_TEST_USERS.find((u) => u.role === role) || null
      }
      if (!fallbackUser) fallbackUser = FALLBACK_TEST_USERS[0]

      return res.json(issueSessionForTestingUser(fallbackUser, res))
    } catch {
      return res.status(500).json({ ok: false, error: 'User selection login failed.' })
    }
  })

  router.post('/auth/login', async (_req, res) => {
    return res.status(400).json({
      ok: false,
      error: 'Credential login is disabled in this testing build. Use user selection.',
    })
  })

  router.post('/auth/logout', async (req, res) => {
    try {
      const token = req.cookies ? req.cookies.autoss_session : null
      if (token) {
        await db.run(`DELETE FROM user_sessions WHERE session_token_hash = ?`, [hashToken(token)])
      }
    } catch {
      // ignore and still clear cookie
    }
    clearSessionCookie(res)
    return res.json({ ok: true })
  })

  router.get('/auth/me', async (req, res) => {
    if (!req.authUser) {
      return res.status(401).json({ ok: false, error: 'No testing user selected' })
    }
    return res.json({
      ok: true,
      user: {
        id: req.authUser.id,
        name: req.authUser.name,
        email: req.authUser.email,
        role: req.authUser.role,
      },
    })
  })

  return router
}

module.exports = {
  createAuthRouter,
}

