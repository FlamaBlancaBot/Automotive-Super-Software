'use strict'

const crypto = require('crypto')

const COOKIE_NAME = 'autoss_session'
const TESTING_USER_COOKIE_NAME = 'autoss_testing_user'

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex')
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex')
}

function parseCookies(req) {
  const cookies = req.cookies || {}
  return cookies
}

async function getSessionUser(db, req) {
  const cookies = parseCookies(req)
  const testingCookie = cookies[TESTING_USER_COOKIE_NAME]
  if (testingCookie) {
    try {
      const parsed = JSON.parse(
        Buffer.from(String(testingCookie), 'base64url').toString('utf8'),
      )
      if (parsed && parsed.id && parsed.name && parsed.role) {
        return {
          id: parsed.id,
          name: parsed.name,
          email: parsed.email || '',
          role: parsed.role,
          active: 1,
          source: 'testing',
        }
      }
    } catch {
      // Ignore malformed testing cookie.
    }
  }

  const token = cookies[COOKIE_NAME]
  if (!token) return null
  const tokenHash = hashToken(token)
  const row = await db.get(
    `
    SELECT
      s.id AS session_id,
      s.user_id,
      s.expires_at,
      u.id,
      u.name,
      u.email,
      u.role,
      u.active
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.session_token_hash = ?
    LIMIT 1
  `,
    [tokenHash],
  )

  if (!row || !row.id || !row.active) return null
  const expiresAt = new Date(row.expires_at)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await db.run(`DELETE FROM user_sessions WHERE id = ?`, [row.session_id])
    return null
  }

  await db.run(
    `UPDATE user_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [row.session_id],
  )

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
  }
}

function setSessionCookie(res, token) {
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: oneWeekMs,
    path: '/',
  })
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
  res.clearCookie(TESTING_USER_COOKIE_NAME, { path: '/' })
}

function setTestingUserCookie(res, user) {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email || '',
      role: user.role,
      source: 'testing',
    }),
  ).toString('base64url')

  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  res.cookie(TESTING_USER_COOKIE_NAME, payload, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: oneWeekMs,
    path: '/',
  })
}

function createAuthMiddleware({ db }) {
  return async function requireAuth(req, res, next) {
    try {
      const user = await getSessionUser(db, req)
      if (!user) return res.status(401).json({ ok: false, error: 'Login required.' })
      req.authUser = user
      next()
    } catch {
      res.status(500).json({ ok: false, error: 'Authentication check failed.' })
    }
  }
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return function roleMiddleware(req, res, next) {
    const user = req.authUser
    if (!user) return res.status(401).json({ ok: false, error: 'Login required.' })
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ ok: false, error: 'You do not have permission for this action.' })
    }
    next()
  }
}

module.exports = {
  COOKIE_NAME,
  hashToken,
  createSessionToken,
  getSessionUser,
  setSessionCookie,
  setTestingUserCookie,
  clearSessionCookie,
  createAuthMiddleware,
  requireRole,
  TESTING_USER_COOKIE_NAME,
}
