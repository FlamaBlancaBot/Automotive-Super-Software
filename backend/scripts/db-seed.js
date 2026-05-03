'use strict'

// Seed is for testing only.
//
// IMPORTANT:
// - This script is designed to be safe and repeatable.
// - It does NOT delete existing data.
// - It inserts small demo records only when tables are empty (or when specific suppliers are missing).
// - Do not treat seed data as real customer data.

const dotenv = require('dotenv')
const { createDb } = require('../db')
const { seedDatabase } = require('../db/seed-logic')

dotenv.config({ quiet: true })

async function main() {
  const db = await createDb()
  const result = await seedDatabase(db)
  await db.close()
  // eslint-disable-next-line no-console
  console.log('Seed complete (testing only).')
  // eslint-disable-next-line no-console
  console.log(`Inserted: ${JSON.stringify(result.inserted)}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err)
  process.exit(1)
})
