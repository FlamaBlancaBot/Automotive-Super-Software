'use strict'

// Database configuration (MySQL/MariaDB only).
//
// Values should come from environment variables in production (Hostinger hPanel),
// and from `backend/.env` for local development.

function toNumber(value, fallback) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

module.exports = {
  host: process.env.DB_HOST || 'localhost',
  port: toNumber(process.env.DB_PORT, 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'automotive_super_software',
}
