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

async function createMysqlDb() {
  const host = process.env.DB_HOST || 'localhost'
  const port = toNumber(process.env.DB_PORT, 3306)
  const database = required('DB_NAME')
  const user = required('DB_USER')
  const password = required('DB_PASSWORD')

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    timezone: 'Z',
  })

  async function all(sql, params) {
    const [rows] = await pool.query(sql, params || [])
    return rows
  }

  async function get(sql, params) {
    const rows = await all(sql, params)
    return rows && rows.length ? rows[0] : null
  }

  async function run(sql, params) {
    const [result] = await pool.query(sql, params || [])
    return {
      lastInsertId: result && result.insertId ? result.insertId : null,
      changes: result && typeof result.affectedRows === 'number' ? result.affectedRows : 0,
    }
  }

  async function transaction(fn) {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()

      const txDb = {
        client: 'mysql',
        info: { host, port, database },
        all: async (sql, params) => {
          const [rows] = await conn.query(sql, params || [])
          return rows
        },
        get: async (sql, params) => {
          const [rows] = await conn.query(sql, params || [])
          return rows && rows.length ? rows[0] : null
        },
        run: async (sql, params) => {
          const [result] = await conn.query(sql, params || [])
          return {
            lastInsertId: result && result.insertId ? result.insertId : null,
            changes:
              result && typeof result.affectedRows === 'number'
                ? result.affectedRows
                : 0,
          }
        },
      }

      const out = await fn(txDb)
      await conn.commit()
      return out
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async function ping() {
    await pool.query('SELECT 1 as ok')
    return { ok: true }
  }

  // Ensure the connection works early (fail fast).
  await ping()

  return {
    client: 'mysql',
    info: { host, port, database },
    all,
    get,
    run,
    transaction,
    ping,
    async close() {
      await pool.end()
    },
  }
}

module.exports = {
  createMysqlDb,
}

