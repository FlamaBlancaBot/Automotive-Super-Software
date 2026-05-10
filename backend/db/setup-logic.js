'use strict'

const { MYSQL_SCHEMA_STATEMENTS } = require('./schema-mysql')

const SETUP_TABLES = [
  'customers',
  'vehicles',
  'customer_vehicles',
  'service_templates',
  'job_statuses',
  'jobs',
  'quotes',
  'quote_items',
  'suppliers',
  'part_supplier_options',
  'reminders',
  'predefined_quote_items',
  'company_settings',
  'technicians',
  'job_technician_assignments',
  'job_activity_events',
  'technician_skills',
  'technician_skill_assignments',
  'workshop_bays',
  'bay_technician_assignments',
  'job_bay_assignments',
  'parts_orders',
  'goods_received',
  'part_status_logs',
  'users',
  'user_sessions',
  'activity_logs',
  'customer_detail_requests',
  'mot_events',
]

async function listExistingTables(db) {
  const placeholders = SETUP_TABLES.map(() => '?').join(',')
  const rows = await db.all(
    `
    SELECT TABLE_NAME as name
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${placeholders})
  `,
    SETUP_TABLES,
  )
  return new Set((rows || []).map((r) => String(r.name)))
}

async function getSetupStatus(db) {
  const existing = await listExistingTables(db)
  const tables = {}

  for (const tableName of SETUP_TABLES) {
    const exists = existing.has(tableName)
    let count = null
    let countError = null
    if (exists) {
      try {
        const row = await db.get(`SELECT COUNT(*) as count FROM \`${tableName}\``)
        count = row ? Number(row.count || 0) : 0
      } catch (err) {
        countError = String(err && err.message ? err.message : err)
      }
    }
    tables[tableName] = { exists, count, count_error: countError }
  }

  return { tables }
}

async function initDatabase(db) {
  for (const sql of MYSQL_SCHEMA_STATEMENTS) {
    const statement = String(sql || '').trim()
    if (!statement) continue
    await db.run(statement)
  }

  // Lightweight migrations for existing deployments.
  // We avoid destructive changes (no drops, no data deletes).
  await migrateDatabase(db)
}

async function columnExists(db, tableName, columnName) {
  const row = await db.get(
    `
    SELECT 1 as ok
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  `,
    [tableName, columnName],
  )
  return Boolean(row && row.ok)
}

async function ensureColumn(db, tableName, columnName, columnSqlDefinition) {
  const exists = await columnExists(db, tableName, columnName)
  if (exists) return false
  await db.run(
    `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnSqlDefinition}`,
  )
  return true
}

async function migrateDatabase(db) {
  // quote_items additions for the table-style Quote Builder.
  await ensureColumn(db, 'quote_items', 'markup_percent', 'DECIMAL(6,2) NULL')
  await ensureColumn(
    db,
    'quote_items',
    'vat_rate',
    'DECIMAL(6,4) NOT NULL DEFAULT 0.2000',
  )
  await ensureColumn(db, 'quote_items', 'eta_text', 'VARCHAR(100) NULL')

  // part_supplier_options: availability + VAT defaults.
  await ensureColumn(
    db,
    'part_supplier_options',
    'vat_rate',
    'DECIMAL(6,4) NOT NULL DEFAULT 0.2000',
  )
  await ensureColumn(
    db,
    'part_supplier_options',
    'is_available',
    'TINYINT(1) NOT NULL DEFAULT 1',
  )
  await ensureColumn(
    db,
    'part_supplier_options',
    'is_ordered',
    'TINYINT(1) NOT NULL DEFAULT 0',
  )

  // Supplier usage flags for dropdown targeting.
  await ensureColumn(db, 'suppliers', 'usage_quotes', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(db, 'suppliers', 'usage_parts', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(db, 'suppliers', 'usage_mot', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(db, 'suppliers', 'usage_diagnostics', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(db, 'suppliers', 'usage_general', 'TINYINT(1) NOT NULL DEFAULT 1')
  await ensureColumn(db, 'service_templates', 'description', 'TEXT NULL')
  await ensureColumn(db, 'vehicles', 'last_lookup_at', 'DATETIME NULL')
  await ensureColumn(db, 'vehicles', 'lookup_source', 'VARCHAR(30) NULL')
  await ensureColumn(db, 'vehicles', 'lookup_error', 'VARCHAR(255) NULL')
  await ensureColumn(db, 'vehicles', 'mot_tests_json', 'JSON NULL')
  await ensureColumn(db, 'vehicles', 'mot_failures_json', 'JSON NULL')
  await ensureColumn(db, 'vehicles', 'mot_advisories_json', 'JSON NULL')
  await ensureColumn(db, 'mot_events', 'mot_type', 'VARCHAR(30) NULL')
  await ensureColumn(
    db,
    'mot_events',
    'expected_duration_minutes',
    'INT NOT NULL DEFAULT 45',
  )
  await ensureColumn(db, 'mot_events', 'result_checked_at', 'DATETIME NULL')

  // Customer details request fields.
  await ensureColumn(db, 'customers', 'email', 'VARCHAR(180) NULL')
  await ensureColumn(db, 'customers', 'postcode', 'VARCHAR(20) NULL')
  await ensureColumn(db, 'customers', 'address', 'TEXT NULL')

  // Job sheet foundation fields.
  await ensureColumn(db, 'jobs', 'mileage_in', 'VARCHAR(30) NULL')
  await ensureColumn(db, 'jobs', 'mileage_out', 'VARCHAR(30) NULL')
  await ensureColumn(db, 'jobs', 'technician_name', 'VARCHAR(150) NULL')
  await ensureColumn(db, 'jobs', 'job_checklist', 'TEXT NULL')
  await ensureColumn(db, 'jobs', 'technician_notes', 'TEXT NULL')
  await ensureColumn(db, 'jobs', 'extra_work_found', 'TEXT NULL')
  await ensureColumn(db, 'jobs', 'final_checks', 'TEXT NULL')
  await ensureColumn(db, 'technicians', 'email', 'VARCHAR(180) NULL')
  await ensureColumn(db, 'technicians', 'phone', 'VARCHAR(40) NULL')
  await ensureColumn(db, 'technicians', 'role_title', 'VARCHAR(120) NULL')
  await ensureColumn(db, 'technicians', 'skills_notes', 'TEXT NULL')

  // parts_orders status simplification migration (safe, non-destructive).
  await db.run(`UPDATE parts_orders SET status = 'pending' WHERE status = 'to_order'`)
  await db.run(`UPDATE parts_orders SET status = 'ordered' WHERE status IN ('expected', 'partially_received')`)
  await db.run(`UPDATE parts_orders SET status = 'received' WHERE status IN ('goods_received', 'fitted')`)
  await db.run(`UPDATE parts_orders SET status = 'return_required' WHERE status = 'wrong_part'`)
  await db.run(`UPDATE parts_orders SET status = 'credit_pending' WHERE status = 'awaiting_credit'`)
}

module.exports = {
  SETUP_TABLES,
  getSetupStatus,
  initDatabase,
}
