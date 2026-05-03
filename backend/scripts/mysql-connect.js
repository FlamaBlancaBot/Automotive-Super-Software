'use strict'

const mysql = require('mysql2/promise')

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function toNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

async function connectMysql() {
  const host = process.env.DB_HOST || 'localhost'
  const port = toNumber(process.env.DB_PORT, 3306)
  const database = required('DB_NAME')
  const user = required('DB_USER')
  const password = required('DB_PASSWORD')

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    timezone: 'Z',
    multipleStatements: true,
  })

  return { conn, host, port, database, user }
}

module.exports = {
  connectMysql,
}

