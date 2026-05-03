'use strict'

// Safe MySQL/MariaDB reset.
//
// This refuses to run unless you explicitly confirm.
// Use this only for testing environments.

const dotenv = require('dotenv')
const { connectMysql } = require('./mysql-connect')

dotenv.config({ quiet: true })

async function main() {
  const confirm = String(process.env.CONFIRM_DB_RESET || '').trim().toUpperCase()
  if (confirm !== 'YES') {
    // eslint-disable-next-line no-console
    console.error(
      'Refusing to reset MySQL/MariaDB database. Set CONFIRM_DB_RESET=YES to proceed (testing only).',
    )
    process.exit(1)
  }

  const { conn, host, port, database, user } = await connectMysql()

  // Drop in FK-safe order.
  await conn.query(`
    DROP TABLE IF EXISTS part_supplier_options;
    DROP TABLE IF EXISTS quote_items;
    DROP TABLE IF EXISTS quotes;
    DROP TABLE IF EXISTS suppliers;
    DROP TABLE IF EXISTS reminders;
    DROP TABLE IF EXISTS jobs;
    DROP TABLE IF EXISTS customer_vehicles;
    DROP TABLE IF EXISTS service_templates;
    DROP TABLE IF EXISTS vehicles;
    DROP TABLE IF EXISTS customers;
  `)

  await conn.end()

  // eslint-disable-next-line no-console
  console.log('MySQL/MariaDB tables dropped (testing only).')
  // eslint-disable-next-line no-console
  console.log(`Connected to: ${user}@${host}:${port}/${database}`)
  // eslint-disable-next-line no-console
  console.log('Next: run `npm run db:init` then `npm run db:seed` if needed.')
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err)
  process.exit(1)
})
