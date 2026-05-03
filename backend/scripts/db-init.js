'use strict'

const dotenv = require('dotenv')
const { createDb } = require('../db')
const { initDatabase } = require('../db/setup-logic')

dotenv.config({ quiet: true })

async function main() {
  const db = await createDb()
  await initDatabase(db)
  const info = db.info || {}
  await db.close()

  // eslint-disable-next-line no-console
  console.log('MySQL/MariaDB schema initialised.')
  // eslint-disable-next-line no-console
  console.log(
    `Connected to: ${info.host || 'localhost'}:${info.port || 3306}/${info.database || ''}`,
  )
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err)
  process.exit(1)
})
