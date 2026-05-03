'use strict'

// MySQL/MariaDB connection check (safe output).
//
// This is designed to be beginner-friendly:
// - If env vars are missing, it prints what is missing (no secrets) and exits non-zero.
// - If connection fails, it prints a short error and exits non-zero.

const dotenv = require('dotenv')
const { connectMysql } = require('./mysql-connect')

dotenv.config({ quiet: true })

async function main() {
  try {
    const { conn, host, port, database, user } = await connectMysql()
    await conn.query('SELECT 1 as ok')
    await conn.end()

    // eslint-disable-next-line no-console
    console.log('Database connection OK.')
    // eslint-disable-next-line no-console
    console.log(`Connected to: ${user}@${host}:${port}/${database}`)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Database connection failed.')
    if (err && err.name === 'AggregateError' && Array.isArray(err.errors)) {
      for (const sub of err.errors) {
        // eslint-disable-next-line no-console
        console.error(String(sub && sub.message ? sub.message : sub))
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(String(err && err.message ? err.message : err))
    }
    // eslint-disable-next-line no-console
    console.error('Check your DB_* environment variables and database access.')
    process.exit(1)
  }
}

main()
