'use strict'

const bcrypt = require('bcryptjs')

// Seed logic for MySQL/MariaDB.
//
// Used by:
// - `npm run db:seed` (CLI)
// - `/api/setup/seed` (browser-based setup)
//
// IMPORTANT:
// - This seed is safe and repeatable.
// - It does NOT delete existing data.

function pad4(n) {
  return String(n).padStart(4, '0')
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function roundMoney(value) {
  return Math.round(toNumber(value, 0) * 100) / 100
}

function formatDateTimeMysql(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  const pad2 = (n) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const day = pad2(d.getDate())
  const hh = pad2(d.getHours())
  const mm = pad2(d.getMinutes())
  const ss = pad2(d.getSeconds())
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

async function countRows(db, tableName) {
  const row = await db.get(`SELECT COUNT(*) as count FROM \`${tableName}\``)
  return row ? Number(row.count || 0) : 0
}

async function ensureJobByTitle(db, values) {
  const existing = await db.get(`SELECT id FROM jobs WHERE title = ? LIMIT 1`, [values.title])
  if (existing && existing.id) return { id: existing.id, created: false }
  const created = await db.run(
    `INSERT INTO jobs (
      customer_id, vehicle_id, service_template_id,
      title, status, priority, requested_date, booked_start, booked_end,
      estimated_duration_minutes, duration_margin_minutes, notes_customer_words, notes_internal
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.customer_id,
      values.vehicle_id,
      values.service_template_id,
      values.title,
      values.status,
      values.priority,
      values.requested_date,
      values.booked_start,
      values.booked_end,
      values.estimated_duration_minutes,
      values.duration_margin_minutes,
      values.notes_customer_words || null,
      values.notes_internal || null,
    ],
  )
  return { id: created.lastInsertId, created: true }
}

async function ensureSupplier(db, name) {
  const row = await db.get(`SELECT id FROM suppliers WHERE name = ? LIMIT 1`, [name])
  if (row && row.id) return { id: row.id, created: false }

  const created = await db.run(
    `INSERT INTO suppliers (name, usage_quotes, usage_parts, usage_mot, usage_diagnostics, usage_general, active)
     VALUES (?, 1, 1, 1, 1, 1, 1)`,
    [name],
  )
  return { id: created.lastInsertId, created: true }
}

async function ensureCustomerByPhone(db, customer) {
  const existing = await db.get(`SELECT id FROM customers WHERE phone = ? LIMIT 1`, [customer.phone])
  if (existing?.id) return { id: existing.id, created: false }
  const created = await db.run(
    `INSERT INTO customers (first_name, surname, phone, email, postcode, address) VALUES (?, ?, ?, ?, ?, ?)`,
    [customer.first_name, customer.surname, customer.phone, customer.email || null, customer.postcode || null, customer.address || null],
  )
  return { id: created.lastInsertId, created: true }
}

async function ensureVehicleByReg(db, vehicle) {
  const existing = await db.get(`SELECT id FROM vehicles WHERE registration = ? LIMIT 1`, [vehicle.registration])
  if (existing?.id) return { id: existing.id, created: false }
  const created = await db.run(
    `INSERT INTO vehicles (
      registration, make, model, year, fuel_type, engine_size, colour, mot_status, mot_expiry, last_mot_date, last_recorded_mileage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vehicle.registration,
      vehicle.make || null,
      vehicle.model || null,
      vehicle.year || null,
      vehicle.fuel_type || null,
      vehicle.engine_size || null,
      vehicle.colour || null,
      vehicle.mot_status || null,
      vehicle.mot_expiry || null,
      vehicle.last_mot_date || null,
      vehicle.last_recorded_mileage || null,
    ],
  )
  return { id: created.lastInsertId, created: true }
}

async function ensureDefaultAdminUser(db) {
  const countRow = await db.get(`SELECT COUNT(*) AS count FROM users`)
  const userCount = Number(countRow?.count || 0)
  if (userCount > 0) return { created: false, warning: null }

  const email = String(process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || '').trim()
  if (!email || !password) {
    return {
      created: false,
      warning:
        'No users exist and DEFAULT_ADMIN_EMAIL/DEFAULT_ADMIN_PASSWORD are missing.',
    }
  }

  const hash = await bcrypt.hash(password, 12)
  await db.run(
    `INSERT INTO users (name, email, password_hash, role, active)
     VALUES (?, ?, ?, 'admin', 1)`,
    ['SYSTEM ADMIN', email, hash],
  )
  return { created: true, warning: null }
}

async function nextQuoteNumber(db) {
  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`

  const row = await db.get(
    `SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`],
  )

  let next = 1
  if (row && row.quote_number) {
    const m = String(row.quote_number).match(/Q-\d{4}-(\d{4})$/)
    if (m && m[1]) next = Number(m[1]) + 1
  }

  return `${prefix}${pad4(next)}`
}

async function ensureServiceTemplate(db, service) {
  const name = String(service && service.name ? service.name : '').trim()
  if (!name) return { id: null, created: false }

  const row = await db.get(
    `SELECT id FROM service_templates WHERE name = ? LIMIT 1`,
    [name],
  )
  if (row && row.id) return { id: row.id, created: false }

  const created = await db.run(
    `INSERT INTO service_templates (
      name, category, fuel_type, default_duration_minutes, duration_confidence,
      fixed_price, requires_quote_first, is_mot, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      name,
      service.category,
      service.fuel_type,
      service.default_duration_minutes,
      service.duration_confidence,
      service.fixed_price,
      service.requires_quote_first,
      service.is_mot,
    ],
  )

  return { id: created.lastInsertId, created: true }
}

async function ensureServiceTemplates(db) {
  const services = [
    { name: 'MOT', category: 'MOT', fuel_type: null, default_duration_minutes: 45, duration_confidence: 'high', fixed_price: null, requires_quote_first: 0, is_mot: 1 },
    { name: 'Diagnostics', category: 'Diagnostics', fuel_type: null, default_duration_minutes: 60, duration_confidence: 'medium', fixed_price: null, requires_quote_first: 0, is_mot: 0 },
    { name: 'Full Service - Petrol', category: 'Service', fuel_type: 'Petrol', default_duration_minutes: 180, duration_confidence: 'medium', fixed_price: 177.20, requires_quote_first: 0, is_mot: 0 },
    { name: 'Full Service - Diesel', category: 'Service', fuel_type: 'Diesel', default_duration_minutes: 210, duration_confidence: 'medium', fixed_price: null, requires_quote_first: 0, is_mot: 0 },
    { name: 'Interim Service - Petrol', category: 'Service', fuel_type: 'Petrol', default_duration_minutes: 120, duration_confidence: 'medium', fixed_price: null, requires_quote_first: 0, is_mot: 0 },
    { name: 'Interim Service - Diesel', category: 'Service', fuel_type: 'Diesel', default_duration_minutes: 140, duration_confidence: 'medium', fixed_price: 190.00, requires_quote_first: 0, is_mot: 0 },
    { name: 'Brake pad check', category: 'Inspection', fuel_type: null, default_duration_minutes: 30, duration_confidence: 'high', fixed_price: null, requires_quote_first: 0, is_mot: 0 },
    { name: 'Timing issue', category: 'Repair', fuel_type: null, default_duration_minutes: 120, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
    { name: 'Engine issue', category: 'Repair', fuel_type: null, default_duration_minutes: 120, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
    { name: 'Oil leak', category: 'Repair', fuel_type: null, default_duration_minutes: 90, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
    { name: 'Suspension noise', category: 'Repair', fuel_type: null, default_duration_minutes: 90, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
    { name: 'Clutch issue', category: 'Repair', fuel_type: null, default_duration_minutes: 180, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
    { name: 'Gearbox issue', category: 'Repair', fuel_type: null, default_duration_minutes: 180, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
    { name: 'Electrical issue', category: 'Repair', fuel_type: null, default_duration_minutes: 90, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
    { name: 'Other', category: 'Other', fuel_type: null, default_duration_minutes: 60, duration_confidence: 'low', fixed_price: null, requires_quote_first: 1, is_mot: 0 },
  ]

  let inserted = 0
  for (const s of services) {
    const r = await ensureServiceTemplate(db, s)
    if (r.created) inserted += 1
  }

  return { inserted }
}

async function ensureJobStatuses(db) {
  const statuses = [
    ['draft', 'Draft', 'grey', 10, 1, 0],
    ['new', 'New', 'blue', 20, 1, 1],
    ['booked', 'Booked', 'blue', 30, 1, 1],
    ['needs_quote', 'Needs Quote', 'orange', 40, 1, 0],
    ['quoted', 'Quoted', 'purple', 50, 1, 0],
    ['waiting_approval', 'Waiting Approval', 'purple', 60, 1, 0],
    ['accepted', 'Accepted', 'green', 70, 1, 0],
    ['awaiting_parts_order', 'Awaiting Parts Order', 'orange', 80, 1, 1],
    ['parts_ordered', 'Parts Ordered', 'orange', 90, 1, 1],
    ['waiting_parts', 'Waiting Parts', 'orange', 100, 1, 1],
    ['parts_received', 'Parts Received', 'teal', 110, 1, 1],
    ['ready', 'Ready', 'teal', 120, 1, 1],
    ['in_progress', 'In Progress', 'blue', 130, 1, 1],
    ['mot_booked', 'MOT Booked', 'blue', 140, 1, 1],
    ['mot_in_progress', 'MOT In Progress', 'blue', 150, 1, 1],
    ['mot_failed', 'MOT Failed', 'red', 160, 1, 0],
    ['mot_passed', 'MOT Passed', 'green', 170, 1, 0],
    ['completed', 'Completed', 'green', 180, 1, 0],
    ['cancelled', 'Cancelled', 'grey', 190, 1, 0],
  ]

  let inserted = 0
  for (const row of statuses) {
    const exists = await db.get(`SELECT id FROM job_statuses WHERE code = ? LIMIT 1`, [row[0]])
    if (exists?.id) continue
    await db.run(
      `INSERT INTO job_statuses (code, label, colour, sort_order, appears_on_calendar, calendar_active, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      row,
    )
    inserted += 1
  }
  return { inserted }
}

async function ensurePredefinedQuoteItem(db, item) {
  const name = String(item && item.name ? item.name : '').trim()
  if (!name) return { id: null, created: false }

  const row = await db.get(
    `SELECT id FROM predefined_quote_items WHERE name = ? LIMIT 1`,
    [name],
  )
  if (row && row.id) return { id: row.id, created: false }

  const created = await db.run(
    `INSERT INTO predefined_quote_items (
      item_type, name, description,
      default_unit, default_cost_ex_vat, default_sell_ex_vat, default_markup_percent,
      vat_rate, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      String(item.item_type || 'other'),
      name,
      item.description || null,
      item.default_unit || null,
      item.default_cost_ex_vat != null ? roundMoney(item.default_cost_ex_vat) : null,
      item.default_sell_ex_vat != null ? roundMoney(item.default_sell_ex_vat) : null,
      item.default_markup_percent != null
        ? roundMoney(item.default_markup_percent)
        : null,
      item.vat_rate != null ? toNumber(item.vat_rate, 0.2) : 0.2,
    ],
  )

  return { id: created.lastInsertId, created: true }
}

async function ensurePredefinedQuoteItems(db) {
  // Starter defaults only. Admin-managed templates come later.
  const items = [
    {
      item_type: 'labour',
      name: 'Labour (hourly)',
      description: 'Workshop labour per hour',
      default_unit: 'hour',
      default_cost_ex_vat: 0,
      default_sell_ex_vat: 60,
      default_markup_percent: null,
      vat_rate: 0.2,
    },
    {
      item_type: 'diagnostic',
      name: 'Diagnostic charge',
      description: 'Initial diagnostic fee',
      default_unit: 'each',
      default_cost_ex_vat: 0,
      default_sell_ex_vat: 60,
      default_markup_percent: null,
      vat_rate: 0.2,
    },
    {
      item_type: 'mot_repair',
      name: 'MOT test (external)',
      description: 'MOT test fee (external station)',
      default_unit: 'each',
      default_cost_ex_vat: 0,
      default_sell_ex_vat: 45,
      default_markup_percent: null,
      vat_rate: 0.2,
    },
    {
      item_type: 'oil',
      name: 'Engine oil (per litre)',
      description: 'Engine oil per litre',
      default_unit: 'litre',
      default_cost_ex_vat: 0,
      default_sell_ex_vat: 12,
      default_markup_percent: null,
      vat_rate: 0.2,
    },
    {
      item_type: 'part',
      name: 'Brake cleaner',
      description: 'Consumable: brake cleaner',
      default_unit: 'each',
      default_cost_ex_vat: 0,
      default_sell_ex_vat: 4.5,
      default_markup_percent: null,
      vat_rate: 0.2,
    },
    {
      item_type: 'service_item',
      name: 'Full Service labour',
      description: 'Service labour line (starter template)',
      default_unit: 'each',
      default_cost_ex_vat: 0,
      default_sell_ex_vat: 120,
      default_markup_percent: null,
      vat_rate: 0.2,
    },
    {
      item_type: 'service_item',
      name: 'Interim Service labour',
      description: 'Service labour line (starter template)',
      default_unit: 'each',
      default_cost_ex_vat: 0,
      default_sell_ex_vat: 80,
      default_markup_percent: null,
      vat_rate: 0.2,
    },
  ]

  let inserted = 0
  for (const item of items) {
    const r = await ensurePredefinedQuoteItem(db, item)
    if (r.created) inserted += 1
  }
  return { inserted }
}

async function ensureDocumentTemplates(db) {
  const templates = [
    ['customer_quote', 'html', 'CUSTOMER QUOTE TEMPLATE', null, '<h1>{{company.name}}</h1><p>{{company.address}} · {{company.phone}}</p><h2>QUOTE {{quote.quote_number}}</h2><p>{{customer.name}} · {{vehicle.registration}} {{vehicle.make}} {{vehicle.model}}</p><table border=\"1\" cellspacing=\"0\" cellpadding=\"6\" width=\"100%\"><tr><th>Item</th><th>Qty</th><th>Sell ex VAT</th><th>Sell inc VAT</th></tr>{{quote.items_html}}</table><p>Subtotal: £{{quote.subtotal_ex_vat}}<br/>VAT: £{{quote.vat_total}}<br/><strong>Total: £{{quote.total_inc_vat}}</strong></p><p>{{quote.notes}}</p>', null],
    ['invoice', 'html', 'INVOICE TEMPLATE', null, '<h1>{{company.name}}</h1><p>{{company.address}}</p><h2>INVOICE {{invoice.invoice_number}}</h2><p>{{customer.name}} · {{vehicle.registration}} {{vehicle.make}} {{vehicle.model}}</p><table border=\"1\" cellspacing=\"0\" cellpadding=\"6\" width=\"100%\"><tr><th>Item</th><th>Qty</th><th>Unit ex VAT</th><th>Total inc VAT</th></tr>{{invoice.items_html}}</table><p>Subtotal: £{{invoice.subtotal_ex_vat}}<br/>VAT: £{{invoice.vat_total}}<br/><strong>Total: £{{invoice.total_inc_vat}}</strong></p><p>{{invoice.notes}}</p>', null],
    ['job_sheet', 'html', 'JOB SHEET TEMPLATE', null, '<h2>{{company.name}} JOB SHEET</h2><h1>{{vehicle.registration}}</h1><p>{{vehicle.make}} {{vehicle.model}} {{vehicle.colour}} {{vehicle.year}} {{vehicle.fuel_type}}</p><p>JOB #{{job.id}} · {{job.title}} · {{job.booked_start}}</p><p>CUSTOMER STATEMENT: {{job.customer_statement}}</p><p>INTERNAL NOTES: {{job.internal_notes}}</p><h3>TASKS</h3>{{job_sheet.tasks_html}}<h3>PARTS</h3>{{job_sheet.parts_html}}<h3>CHECKLIST</h3>{{job_sheet.checklist_html}}<p>MILEAGE IN: ______ MILEAGE OUT: ______ TOTAL HOURS: ______</p><p>TEST DRIVEN [ ] READY TO CALL CUSTOMER [ ] TECH SIGN: __________ DATE: ______</p>', null],
    ['email_quote_ready', 'email', 'EMAIL QUOTE READY', 'QUOTE READY {{quote.quote_number}}', '<p>Hello {{customer.name}}, your quote {{quote.quote_number}} is ready.</p><p>Total including VAT: £{{quote.total_inc_vat}}</p>', 'Hello {{customer.name}}, your quote {{quote.quote_number}} is ready. Total inc VAT: £{{quote.total_inc_vat}}'],
    ['email_invoice_ready', 'email', 'EMAIL INVOICE READY', 'INVOICE READY {{invoice.invoice_number}}', '<p>Hello {{customer.name}}, your invoice {{invoice.invoice_number}} is ready.</p><p>Total including VAT: £{{invoice.total_inc_vat}}</p>', 'Hello {{customer.name}}, your invoice {{invoice.invoice_number}} is ready. Total inc VAT: £{{invoice.total_inc_vat}}'],
    ['sms_customer_details_request', 'sms', 'SMS CUSTOMER DETAILS REQUEST', null, null, 'AUTOSS: Please provide your details for {{vehicle.registration}}.'],
    ['sms_quote_ready', 'sms', 'SMS QUOTE READY', null, null, 'AUTOSS: Quote {{quote.quote_number}} ready for {{vehicle.registration}}. Total £{{quote.total_inc_vat}}.'],
    ['sms_vehicle_update', 'sms', 'SMS VEHICLE UPDATE', null, null, 'AUTOSS update: {{vehicle.registration}} job {{job.status}}.'],
  ]
  let inserted = 0
  for (const t of templates) {
    const exists = await db.get(`SELECT id FROM document_templates WHERE template_key = ? LIMIT 1`, [t[0]])
    if (exists?.id) continue
    await db.run(
      `INSERT INTO document_templates (template_key, template_type, name, subject, body_html, body_text, active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      t,
    )
    inserted += 1
  }
  return { inserted }
}

async function seedDatabase(db) {
  return db.transaction(async (tx) => {
    const createdSuppliers = []
    for (const name of ['ECP', 'Jayar', 'PartsDirect']) {
      const s = await ensureSupplier(tx, name)
      if (s.created) createdSuppliers.push(name)
    }

    const serviceTemplates = await ensureServiceTemplates(tx)
    const jobStatuses = await ensureJobStatuses(tx)
    const predefinedQuoteItems = await ensurePredefinedQuoteItems(tx)
    const documentTemplates = await ensureDocumentTemplates(tx)

    const customersCount = await countRows(tx, 'customers')
    const vehiclesCount = await countRows(tx, 'vehicles')
    const jobsCount = await countRows(tx, 'jobs')
    const quotesCount = await countRows(tx, 'quotes')
    const partsOrdersCount = await countRows(tx, 'parts_orders')
    const companySettingsCount = await countRows(tx, 'company_settings')
    const techniciansCount = await countRows(tx, 'technicians')
    const motEventsCount = await countRows(tx, 'mot_events')

    const customerIds = []
    if (customersCount === 0) {
      const customers = [
        { first_name: 'John', surname: 'Smith', phone: '07123 456789' },
        { first_name: 'Aisha', surname: 'Khan', phone: '07911 222333' },
        { first_name: 'Peter', surname: 'Williams', phone: '07000 123456' },
      ]
      for (const c of customers) {
        const r = await tx.run(
          `INSERT INTO customers (first_name, surname, phone) VALUES (?, ?, ?)`,
          [c.first_name, c.surname, c.phone],
        )
        customerIds.push(r.lastInsertId)
      }
    } else {
      const rows = await tx.all(`SELECT id FROM customers ORDER BY id ASC LIMIT 3`)
      for (const row of rows || []) customerIds.push(row.id)
    }

    const vehicleIds = []
    if (vehiclesCount === 0) {
      const vehicles = [
        {
          registration: 'AB12CDE',
          make: 'BMW',
          model: '320d',
          year: '2016',
          fuel_type: 'Diesel',
          engine_size: '2.0L',
          colour: 'Black',
          mot_status: 'Valid',
          mot_expiry: '2026-11-18',
          last_mot_date: '2025-11-10',
          last_recorded_mileage: '86400',
        },
        {
          registration: 'GK15PRT',
          make: 'Ford',
          model: 'Fiesta',
          year: '2015',
          fuel_type: 'Petrol',
          engine_size: '1.0L',
          colour: 'Blue',
          mot_status: 'Due soon',
          mot_expiry: '2026-05-22',
          last_mot_date: '2025-05-20',
          last_recorded_mileage: '70320',
        },
        {
          registration: 'LM66VHX',
          make: 'Volkswagen',
          model: 'Golf',
          year: '2016',
          fuel_type: 'Diesel',
          engine_size: '1.6L',
          colour: 'Grey',
          mot_status: 'Expired (demo)',
          mot_expiry: '2026-03-11',
          last_mot_date: '2025-03-08',
          last_recorded_mileage: '99210',
        },
        {
          registration: 'YD19ZZZ',
          make: 'Toyota',
          model: 'Yaris',
          year: '2019',
          fuel_type: 'Petrol',
          engine_size: '1.5L',
          colour: 'White',
          mot_status: 'Valid',
          mot_expiry: '2026-09-02',
          last_mot_date: '2025-08-27',
          last_recorded_mileage: '41200',
        },
      ]

      for (const v of vehicles) {
        const r = await tx.run(
          `INSERT INTO vehicles (
            registration, make, model, year, fuel_type, engine_size, colour,
            mot_status, mot_expiry, last_mot_date, last_recorded_mileage
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            v.registration,
            v.make,
            v.model,
            v.year,
            v.fuel_type,
            v.engine_size,
            v.colour,
            v.mot_status,
            v.mot_expiry,
            v.last_mot_date,
            v.last_recorded_mileage,
          ],
        )
        vehicleIds.push(r.lastInsertId)
      }

      // Link some customers to vehicles (only when we just created demo data).
      if (customerIds.length >= 2 && vehicleIds.length >= 3) {
        await tx.run(
          `INSERT INTO customer_vehicles (customer_id, vehicle_id, relationship_status, is_current_owner)
           VALUES (?, ?, 'keeper', 1), (?, ?, 'keeper', 1), (?, ?, 'keeper', 1)`,
          [customerIds[0], vehicleIds[0], customerIds[0], vehicleIds[1], customerIds[1], vehicleIds[2]],
        )
      }
    } else {
      const rows = await tx.all(`SELECT id FROM vehicles ORDER BY id ASC LIMIT 4`)
      for (const row of rows || []) vehicleIds.push(row.id)
    }

    // Add broader realistic demo dataset (safe insert-if-missing).
    const extraCustomers = [
      { first_name: 'MAYA', surname: 'THOMAS', phone: '07555 111222', email: 'MAYA@AUTOSS.TEST', postcode: 'E1 1AA', address: '12 TEST ROAD, LONDON' },
      { first_name: 'LUKE', surname: 'PARKER', phone: '07555 111333', email: 'LUKE@AUTOSS.TEST', postcode: 'E2 2BB', address: '27 WORKSHOP LANE, LONDON' },
      { first_name: 'EMMA', surname: 'NOLAN', phone: '07555 111444', email: 'EMMA@AUTOSS.TEST', postcode: 'E3 3CC', address: '5 GARAGE COURT, LONDON' },
    ]
    const extraVehicles = [
      { registration: 'RX22MOT', make: 'AUDI', model: 'A3', year: '2022', fuel_type: 'PETROL', engine_size: '1.5L', colour: 'RED', mot_status: 'VALID' },
      { registration: 'SV18FIX', make: 'VAUXHALL', model: 'CORSA', year: '2018', fuel_type: 'PETROL', engine_size: '1.4L', colour: 'SILVER', mot_status: 'DUE SOON' },
      { registration: 'PJ14DIE', make: 'PEUGEOT', model: '308', year: '2014', fuel_type: 'DIESEL', engine_size: '1.6L', colour: 'BLUE', mot_status: 'EXPIRED' },
    ]
    for (const c of extraCustomers) {
      const createdCustomer = await ensureCustomerByPhone(tx, c)
      if (createdCustomer?.id && !customerIds.includes(createdCustomer.id)) customerIds.push(createdCustomer.id)
    }
    for (const v of extraVehicles) {
      const createdVehicle = await ensureVehicleByReg(tx, v)
      if (createdVehicle?.id && !vehicleIds.includes(createdVehicle.id)) vehicleIds.push(createdVehicle.id)
    }

    const services = await tx.all(
      `SELECT id, name FROM service_templates WHERE active = 1 ORDER BY id ASC`,
    )
    const serviceId = services && services.length ? services[0].id : null
    const serviceId2 = services && services.length > 1 ? services[1].id : serviceId
    const motService = (services || []).find((s) => String(s.name || '').toUpperCase() === 'MOT') || null
    const diagnosticService =
      (services || []).find((s) => String(s.name || '').toUpperCase() === 'DIAGNOSTICS') || null
    const fullServicePetrol =
      (services || []).find((s) => String(s.name || '').toUpperCase() === 'FULL SERVICE - PETROL') || null

    if (jobsCount === 0 && customerIds.length && vehicleIds.length) {
      if (serviceId) {
        await tx.run(
          `INSERT INTO jobs (
            customer_id, vehicle_id, service_template_id,
            title, status, priority, requested_date, booked_start, booked_end,
            estimated_duration_minutes, duration_margin_minutes
          ) VALUES
          (?, ?, ?, 'Diagnostics - AB12CDE', 'booked_in', 'normal', '2026-04-27', '2026-04-27 09:00:00', '2026-04-27 10:00:00', 60, 15),
          (?, ?, ?, 'Full Service - LM66VHX', 'booked_in', 'high_value', '2026-04-27', '2026-04-27 10:30:00', '2026-04-27 13:30:00', 180, 30)`,
          [customerIds[0], vehicleIds[0], serviceId2, customerIds[1] || customerIds[0], vehicleIds[2] || vehicleIds[0], serviceId],
        )

        // Add one more job so Jobs + quotes linking can be tested.
        await tx.run(
          `INSERT INTO jobs (
            customer_id, vehicle_id, service_template_id,
            title, status, priority, requested_date, booked_start, booked_end,
            estimated_duration_minutes, duration_margin_minutes
          ) VALUES (?, ?, ?, 'Booking - GK15PRT', 'booked_in', 'urgent', '2026-04-28', '2026-04-28 11:00:00', '2026-04-28 12:00:00', 60, 15)`,
          [customerIds[2] || customerIds[0], vehicleIds[1] || vehicleIds[0], serviceId],
        )

        // Extra variety for scenario testing (only when the database is empty).
        await tx.run(
          `INSERT INTO jobs (
            customer_id, vehicle_id, service_template_id,
            title, status, priority, requested_date, booked_start, booked_end,
            estimated_duration_minutes, duration_margin_minutes, notes_customer_words, notes_internal
          ) VALUES
          (?, ?, ?, 'MOT - YD19ZZZ', 'awaiting_authorisation', 'normal', '2026-04-29', '2026-04-29 09:00:00', '2026-04-29 10:00:00', 60, 15, 'Customer wants MOT, may need tyres.', 'Check tyre tread + advise.'),
          (?, ?, ?, 'Oil leak investigation - LM66VHX', 'in_progress', 'waiting_customer', '2026-04-26', '2026-04-26 14:00:00', '2026-04-26 15:30:00', 90, 20, 'Oil leak on driveway.', 'Raise on ramp and inspect.'),
          (?, ?, ?, 'Brake noise - GK15PRT', 'awaiting_parts', 'urgent', '2026-04-30', NULL, NULL, 60, 15, 'Grinding noise when braking.', 'Likely pads/discs; quote parts.')`,
          [
            customerIds[0],
            vehicleIds[3] || vehicleIds[0],
            serviceId,
            customerIds[1] || customerIds[0],
            vehicleIds[2] || vehicleIds[0],
            serviceId,
            customerIds[2] || customerIds[0],
            vehicleIds[1] || vehicleIds[0],
            serviceId2,
          ],
        )
      }
    }

    // Richer, repeatable scenario jobs (safe: insert only if title missing).
    if (customerIds.length && vehicleIds.length && serviceId) {
      const now = new Date()
      const today = formatDateTimeMysql(now).slice(0, 10)
      const plusHours = (hours) => formatDateTimeMysql(new Date(now.getTime() + hours * 60 * 60 * 1000))
      const plusDays = (days) => formatDateTimeMysql(new Date(now.getTime() + days * 24 * 60 * 60 * 1000))

      await ensureJobByTitle(tx, {
        customer_id: customerIds[0],
        vehicle_id: vehicleIds[0],
        service_template_id: diagnosticService ? diagnosticService.id : serviceId,
        title: 'MOT BOOKED - AB12CDE',
        status: 'booked_in',
        priority: 'normal',
        requested_date: today,
        booked_start: plusHours(2),
        booked_end: plusHours(3),
        estimated_duration_minutes: 60,
        duration_margin_minutes: 15,
        notes_customer_words: 'BOOKING FOR MOT TEST.',
        notes_internal: 'DEMO SCENARIO: MOT BOOKED.',
      })

      await ensureJobByTitle(tx, {
        customer_id: customerIds[1] || customerIds[0],
        vehicle_id: vehicleIds[1] || vehicleIds[0],
        service_template_id: fullServicePetrol ? fullServicePetrol.id : serviceId,
        title: 'MOT FAILED - GK15PRT',
        status: 'awaiting_authorisation',
        priority: 'urgent',
        requested_date: today,
        booked_start: plusHours(-4),
        booked_end: plusHours(-3),
        estimated_duration_minutes: 60,
        duration_margin_minutes: 20,
        notes_customer_words: 'FAILED MOT, NEEDS REPAIRS.',
        notes_internal: 'DEMO SCENARIO: MOT FAILED, QUOTE REQUIRED.',
      })

      await ensureJobByTitle(tx, {
        customer_id: customerIds[2] || customerIds[0],
        vehicle_id: vehicleIds[2] || vehicleIds[0],
        service_template_id: motService ? motService.id : serviceId,
        title: 'MOT PASSED - LM66VHX',
        status: 'completed',
        priority: 'normal',
        requested_date: today,
        booked_start: plusHours(-12),
        booked_end: plusHours(-11),
        estimated_duration_minutes: 45,
        duration_margin_minutes: 10,
        notes_customer_words: 'MOT COMPLETED.',
        notes_internal: 'DEMO SCENARIO: MOT PASSED.',
      })

      await ensureJobByTitle(tx, {
        customer_id: customerIds[0],
        vehicle_id: vehicleIds[3] || vehicleIds[0],
        service_template_id: serviceId2 || serviceId,
        title: 'OVERLAP TEST - YD19ZZZ SLOT A',
        status: 'booked_in',
        priority: 'high_value',
        requested_date: today,
        booked_start: plusDays(1),
        booked_end: plusDays(1),
        estimated_duration_minutes: 180,
        duration_margin_minutes: 30,
        notes_customer_words: 'BOOKED FOR SERVICE.',
        notes_internal: 'DEMO SCENARIO: OVERLAPPING CAPACITY TEST A.',
      })

      await ensureJobByTitle(tx, {
        customer_id: customerIds[1] || customerIds[0],
        vehicle_id: vehicleIds[0],
        service_template_id: serviceId2 || serviceId,
        title: 'OVERLAP TEST - AB12CDE SLOT B',
        status: 'booked_in',
        priority: 'waiting_customer',
        requested_date: today,
        booked_start: plusDays(1),
        booked_end: plusDays(1),
        estimated_duration_minutes: 120,
        duration_margin_minutes: 15,
        notes_customer_words: 'WAITING WHILE VEHICLE IS CHECKED.',
        notes_internal: 'DEMO SCENARIO: OVERLAPPING CAPACITY TEST B.',
      })

      await ensureJobByTitle(tx, {
        customer_id: customerIds[3] || customerIds[0],
        vehicle_id: vehicleIds[4] || vehicleIds[0],
        service_template_id: serviceId2 || serviceId,
        title: 'IN PROGRESS - RX22MOT',
        status: 'in_progress',
        priority: 'urgent',
        requested_date: today,
        booked_start: plusHours(-2),
        booked_end: plusHours(2),
        estimated_duration_minutes: 240,
        duration_margin_minutes: 30,
        notes_customer_words: 'ENGINE MANAGEMENT LIGHT ON.',
        notes_internal: 'DIAGNOSTICS UNDERWAY.',
      })

      await ensureJobByTitle(tx, {
        customer_id: customerIds[4] || customerIds[0],
        vehicle_id: vehicleIds[5] || vehicleIds[0],
        service_template_id: serviceId || serviceId2,
        title: 'NO QUOTE YET - SV18FIX',
        status: 'booked_in',
        priority: 'normal',
        requested_date: today,
        booked_start: plusHours(8),
        booked_end: plusHours(10),
        estimated_duration_minutes: 120,
        duration_margin_minutes: 15,
        notes_customer_words: 'BRAKE CHECK REQUESTED.',
        notes_internal: 'PENDING INITIAL INSPECTION.',
      })
    }

    let seededQuotes = 0
    if (quotesCount === 0 && customerIds.length && vehicleIds.length) {
      const suppliers = await tx.all(`SELECT id, name FROM suppliers WHERE active = 1 ORDER BY id ASC`)
      const supplierId = suppliers && suppliers.length ? suppliers[0].id : null

      const job1 = await tx.get(
        `SELECT id FROM jobs WHERE vehicle_id = ? ORDER BY id ASC LIMIT 1`,
        [vehicleIds[0]],
      )
      const job2 = await tx.get(
        `SELECT id FROM jobs WHERE vehicle_id = ? ORDER BY id ASC LIMIT 1`,
        [vehicleIds[1] || vehicleIds[0]],
      )

      const q1 = await nextQuoteNumber(tx)
      const q1r = await tx.run(
        `INSERT INTO quotes (quote_number, customer_id, vehicle_id, job_id, status, title, internal_notes, customer_notes)
         VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`,
        [q1, customerIds[0], vehicleIds[0], job1 ? job1.id : null, 'Brake pads + fitting', 'Created by seed (testing only).', 'Customer asked for a rough estimate.'],
      )
      const quote1Id = q1r.lastInsertId

      await tx.run(
        `INSERT INTO quote_items (
          quote_id, item_type, description, quantity,
          unit_cost, unit_sell, total_cost, total_sell,
          supplier_id, part_brand, part_number, selected_for_quote, sort_order
        ) VALUES
        (?, 'labour', 'Labour (estimate)', 1.00, 0.00, 45.00, 0.00, 45.00, NULL, NULL, NULL, 1, 10),
        (?, 'part', 'Front brake pads', 1.00, 22.00, 55.00, 22.00, 55.00, ?, 'Pagid', 'N/A', 1, 20)`,
        [quote1Id, quote1Id, supplierId],
      )

      const q2 = await nextQuoteNumber(tx)
      const q2r = await tx.run(
        `INSERT INTO quotes (quote_number, customer_id, vehicle_id, job_id, status, title, internal_notes, customer_notes)
         VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`,
        [q2, customerIds[1] || customerIds[0], vehicleIds[1] || vehicleIds[0], job2 ? job2.id : null, 'Diagnostics - warning light', 'Created by seed (testing only).', 'Customer reports an intermittent warning light.'],
      )
      const quote2Id = q2r.lastInsertId

      await tx.run(
        `INSERT INTO quote_items (
          quote_id, item_type, description, quantity,
          unit_cost, unit_sell, total_cost, total_sell,
          supplier_id, part_brand, part_number, selected_for_quote, sort_order
        ) VALUES
        (?, 'diagnostic', 'Diagnostics (initial)', 1.00, 0.00, 60.00, 0.00, 60.00, NULL, NULL, NULL, 1, 10)`,
        [quote2Id],
      )

      // Totals update for both quotes.
      const quoteIds = [quote1Id, quote2Id]
      for (const id of quoteIds) {
        const sums = await tx.get(
          `
          SELECT
            COALESCE(SUM(total_cost), 0) AS subtotal_cost,
            COALESCE(SUM(total_sell), 0) AS subtotal_sell
          FROM quote_items
          WHERE quote_id = ? AND selected_for_quote = 1
        `,
          [id],
        )

        const subtotalCost = roundMoney(sums ? sums.subtotal_cost : 0)
        const subtotalSell = roundMoney(sums ? sums.subtotal_sell : 0)
        const vatRateRow = await tx.get(`SELECT vat_rate FROM quotes WHERE id = ?`, [id])
        const vatRate = vatRateRow ? toNumber(vatRateRow.vat_rate, 0.2) : 0.2
        const vatAmount = roundMoney(subtotalSell * vatRate)
        const totalSell = roundMoney(subtotalSell + vatAmount)
        const margin = roundMoney(subtotalSell - subtotalCost)

        await tx.run(
          `
          UPDATE quotes
          SET
            subtotal_cost = ?,
            subtotal_sell = ?,
            vat_amount = ?,
            total_sell = ?,
            estimated_margin = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [subtotalCost, subtotalSell, vatAmount, totalSell, margin, id],
        )
      }

      seededQuotes = 2
    }

    let seededCompanySettings = 0
    // Add richer quote/parts/invoice scenarios if missing.
    const existingRichQuote = await tx.get(`SELECT id FROM quotes WHERE title = 'RICH DEMO QUOTE - MULTI SUPPLIER' LIMIT 1`)
    if (!existingRichQuote && customerIds.length && vehicleIds.length) {
      const richJob = await tx.get(`SELECT id, customer_id, vehicle_id FROM jobs WHERE title = 'IN PROGRESS - RX22MOT' LIMIT 1`)
      if (richJob?.id) {
        const quoteNumber = await nextQuoteNumber(tx)
        const createdQuote = await tx.run(
          `INSERT INTO quotes (quote_number, customer_id, vehicle_id, job_id, status, title, customer_notes, internal_notes)
           VALUES (?, ?, ?, ?, 'accepted', 'RICH DEMO QUOTE - MULTI SUPPLIER', ?, ?)`,
          [quoteNumber, richJob.customer_id, richJob.vehicle_id, richJob.id, 'APPROVED BY CUSTOMER.', 'INTERNAL COMPARISON DATA INCLUDED.'],
        )
        const quoteId = createdQuote.lastInsertId
        await tx.run(
          `INSERT INTO quote_items (quote_id, item_type, description, quantity, unit_cost, unit_sell, total_cost, total_sell, selected_for_quote, sort_order)
           VALUES
           (?, 'part', 'FRONT BRAKE PADS', 1, 40, 95, 40, 95, 1, 10),
           (?, 'part', 'FRONT BRAKE DISCS', 2, 55, 120, 110, 240, 1, 20),
           (?, 'labour', 'BRAKE FITTING LABOUR', 2, 35, 70, 70, 140, 1, 30),
           (?, 'diagnostic', 'BRAKE SYSTEM CHECK', 1, 0, 35, 0, 35, 1, 40),
           (?, 'oil', 'WORKSHOP CONSUMABLES', 1, 4, 12, 4, 12, 1, 50)`,
          [quoteId, quoteId, quoteId, quoteId, quoteId],
        )
      }
    }

    const invoiceCount = await countRows(tx, 'invoices').catch(() => 0)
    if (invoiceCount === 0) {
      const acceptedQuote = await tx.get(`SELECT * FROM quotes WHERE status = 'accepted' ORDER BY id DESC LIMIT 1`)
      if (acceptedQuote?.id) {
        const year = new Date().getFullYear()
        const invoiceNumber = `INV-${year}-0001`
        const inv = await tx.run(
          `INSERT INTO invoices (job_id, quote_id, customer_id, vehicle_id, invoice_number, status, subtotal_ex_vat, vat_total, total_inc_vat, notes)
           VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
          [
            acceptedQuote.job_id,
            acceptedQuote.id,
            acceptedQuote.customer_id,
            acceptedQuote.vehicle_id,
            invoiceNumber,
            acceptedQuote.subtotal_sell || 0,
            acceptedQuote.vat_amount || 0,
            acceptedQuote.total_sell || 0,
            'PAYMENT TERMS: DUE ON COLLECTION.',
          ],
        )
        const quoteItems = await tx.all(`SELECT * FROM quote_items WHERE quote_id = ? AND selected_for_quote = 1 ORDER BY sort_order ASC`, [acceptedQuote.id])
        for (const it of quoteItems || []) {
          await tx.run(
            `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price_ex_vat, vat_rate, total_ex_vat, total_inc_vat)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              inv.lastInsertId,
              it.item_type || 'other',
              it.description || 'ITEM',
              it.quantity || 1,
              it.unit_sell || 0,
              it.vat_rate || 0.2,
              it.total_sell || 0,
              roundMoney((it.total_sell || 0) * (1 + toNumber(it.vat_rate, 0.2))),
            ],
          )
        }
      }
    }

    if (companySettingsCount === 0) {
      await tx.run(
        `INSERT INTO company_settings (
          company_name, trading_name, phone, email, address, vat_number,
          default_vat_rate, quote_prefix, invoice_prefix, theme_default
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'AUTOSS GARAGE LTD',
          'AUTOSS',
          '0208 555 1000',
          'ops@autoss.local',
          'UNIT 4, TEST PARK, LONDON',
          'GB000000000',
          0.2,
          'Q',
          'INV',
          'dark',
        ],
      )
      seededCompanySettings = 1
    }

    let seededTechnicians = 0
    if (techniciansCount === 0) {
      const technicians = [
        ['ALEX TURNER', 'MOT, SERVICE, BRAKES', 1],
        ['SAM PATEL', 'DIAGNOSTICS, ELECTRICAL, ENGINE', 1],
        ['RILEY SHAW', 'GEARBOX, CLUTCH, SUSPENSION', 1],
        ['JORDAN REED', 'SERVICE, TYRES, QUICK FIT', 1],
      ]
      for (const tech of technicians) {
        await tx.run(
          `INSERT INTO technicians (name, capabilities, active) VALUES (?, ?, ?)`,
          tech,
        )
      }
      seededTechnicians = technicians.length
    }

    const defaultAdmin = await ensureDefaultAdminUser(tx)

    let seededPartsOrders = 0
    if (partsOrdersCount === 0) {
      const suppliers = await tx.all(`SELECT id, name FROM suppliers WHERE active = 1 ORDER BY id ASC`)
      const ecp = suppliers.find((s) => s.name === 'ECP') || suppliers[0] || null
      const jayar = suppliers.find((s) => s.name === 'Jayar') || suppliers[1] || ecp || null
      const partsDirect = suppliers.find((s) => s.name === 'PartsDirect') || suppliers[2] || ecp || null

      const jobRows = await tx.all(
        `SELECT id, customer_id, vehicle_id, title FROM jobs ORDER BY id ASC LIMIT 3`,
      )
      const job1 = jobRows && jobRows.length ? jobRows[0] : null
      const job2 = jobRows && jobRows.length > 1 ? jobRows[1] : job1
      const job3 = jobRows && jobRows.length > 2 ? jobRows[2] : job1

      const quoteForJob1 = job1
        ? await tx.get(`SELECT id FROM quotes WHERE job_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`, [job1.id])
        : null

      const now = new Date()
      const expectedToday = new Date(now)
      expectedToday.setHours(14, 0, 0, 0)
      const expectedYesterday = new Date(expectedToday)
      expectedYesterday.setDate(expectedToday.getDate() - 1)

      async function insertPartsOrder(values) {
        const created = await tx.run(
          `INSERT INTO parts_orders (
            job_id, quote_id, vehicle_id, customer_id, supplier_id,
            part_name, description, brand, part_number, quantity,
            cost_ex_vat, sell_ex_vat, vat_rate,
            eta_text, eta_datetime, expected_at,
            status, ordered_at, received_at,
            supplier_invoice_number, delivery_note_number, received_by,
            return_status, return_reason, credit_note_number,
            notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            values.job_id || null,
            values.quote_id || null,
            values.vehicle_id || null,
            values.customer_id || null,
            values.supplier_id || null,
            values.part_name || 'Part',
            values.description || values.part_name || 'Part',
            values.brand || null,
            values.part_number || null,
            values.quantity != null ? roundMoney(values.quantity) : 1,
            values.cost_ex_vat != null ? roundMoney(values.cost_ex_vat) : 0,
            values.sell_ex_vat != null ? roundMoney(values.sell_ex_vat) : 0,
            values.vat_rate != null ? toNumber(values.vat_rate, 0.2) : 0.2,
            values.eta_text || null,
            values.eta_datetime || null,
            values.expected_at || null,
            values.status || 'pending',
            values.ordered_at || null,
            values.received_at || null,
            values.supplier_invoice_number || null,
            values.delivery_note_number || null,
            values.received_by || null,
            values.return_status || null,
            values.return_reason || null,
            values.credit_note_number || null,
            values.notes || null,
          ],
        )

        await tx.run(
          `INSERT INTO part_status_logs (parts_order_id, old_status, new_status, notes)
           VALUES (?, NULL, ?, ?)`,
          [created.lastInsertId, values.status || 'pending', 'Seed demo order'],
        )

        return created.lastInsertId
      }

      // Example 1: ECP ordered part expected today.
      if (ecp && job1) {
        await insertPartsOrder({
          job_id: job1.id,
          quote_id: quoteForJob1 ? quoteForJob1.id : null,
          vehicle_id: job1.vehicle_id,
          customer_id: job1.customer_id,
          supplier_id: ecp.id,
          part_name: 'Front brake pads',
          brand: 'Pagid',
          part_number: 'PD-1234',
          quantity: 1,
          cost_ex_vat: 22,
          sell_ex_vat: 55,
          vat_rate: 0.2,
          eta_text: 'Expected today',
          expected_at: formatDateTimeMysql(expectedToday),
          status: 'ordered',
          ordered_at: formatDateTimeMysql(new Date(now.getTime() - 60 * 60 * 1000)),
          notes: 'Seed demo: ordered part expected today.',
        })
        seededPartsOrders += 1
      }

      // Example 2: Jayar goods received with invoice/delivery note.
      if (jayar && job2) {
        const orderId = await insertPartsOrder({
          job_id: job2.id,
          vehicle_id: job2.vehicle_id,
          customer_id: job2.customer_id,
          supplier_id: jayar.id,
          part_name: 'Oil filter',
          brand: 'Mann',
          part_number: 'OF-987',
          quantity: 1,
          cost_ex_vat: 6,
          sell_ex_vat: 14,
          vat_rate: 0.2,
          eta_text: 'Arrived',
          expected_at: formatDateTimeMysql(expectedYesterday),
          status: 'received',
          ordered_at: formatDateTimeMysql(new Date(now.getTime() - 26 * 60 * 60 * 1000)),
          received_at: formatDateTimeMysql(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
          supplier_invoice_number: 'INV-1001',
          delivery_note_number: 'DN-2001',
          received_by: 'Seed',
          notes: 'Seed demo: goods received.',
        })

        await tx.run(
          `INSERT INTO goods_received (
            parts_order_id, quantity_received, received_at, received_by,
            supplier_invoice_number, delivery_note_number,
            correct_part, condition_ok, return_required, notes
          ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?)`,
          [
            orderId,
            1,
            formatDateTimeMysql(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
            'Seed',
            'INV-1001',
            'DN-2001',
            'Seed demo: received and checked.',
          ],
        )

        seededPartsOrders += 1
      }

      // Example 3: PartsDirect return required / wrong part.
      if (partsDirect && job3) {
        await insertPartsOrder({
          job_id: job3.id,
          vehicle_id: job3.vehicle_id,
          customer_id: job3.customer_id,
          supplier_id: partsDirect.id,
          part_name: 'Drop link (left)',
          brand: 'Febi',
          part_number: 'DL-555',
          quantity: 1,
          cost_ex_vat: 9.5,
          sell_ex_vat: 24,
          vat_rate: 0.2,
          eta_text: 'Returned',
          expected_at: formatDateTimeMysql(expectedYesterday),
          status: 'return_required',
          ordered_at: formatDateTimeMysql(new Date(now.getTime() - 48 * 60 * 60 * 1000)),
          received_at: formatDateTimeMysql(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
          supplier_invoice_number: 'INV-2002',
          delivery_note_number: 'DN-3002',
          received_by: 'Seed',
          return_status: 'return_required',
          return_reason: 'Wrong fitment (seed demo).',
          notes: 'Seed demo: return required.',
        })
        seededPartsOrders += 1
      }
    }

    let seededMotEvents = 0
    if (motEventsCount === 0) {
      const motJobs = await tx.all(
        `SELECT id, vehicle_id, mot_time, status
         FROM jobs
         WHERE LOWER(title) LIKE '%MOT%'
         ORDER BY id ASC
         LIMIT 3`,
      )
      for (const job of motJobs || []) {
        const exists = await tx.get(`SELECT id FROM mot_events WHERE job_id = ? LIMIT 1`, [job.id])
        if (exists?.id) continue
        await tx.run(
          `INSERT INTO mot_events (job_id, vehicle_id, mot_time, status, result)
           VALUES (?, ?, ?, ?, ?)`,
          [
            job.id,
            job.vehicle_id,
            job.mot_time || null,
            String(job.status || '').toLowerCase().includes('in_progress')
              ? 'in_progress'
              : 'booked',
            String(job.status || '').toLowerCase().includes('failed')
              ? 'failed'
              : String(job.status || '').toLowerCase().includes('passed')
                ? 'passed'
                : null,
          ],
        )
        seededMotEvents += 1
      }
    }

    // Seed richer quote supplier comparison scenarios (safe, only missing rows).
    let seededSupplierOptions = 0
    const samplePartItems = await tx.all(
      `SELECT qi.id, qi.quote_id
       FROM quote_items qi
       WHERE qi.item_type IN ('part', 'oil', 'service_item')
       ORDER BY qi.id ASC
       LIMIT 3`,
    )
    const supplierRows = await tx.all(`SELECT id, name FROM suppliers ORDER BY id ASC LIMIT 5`)
    if (samplePartItems.length && supplierRows.length >= 2) {
      for (const item of samplePartItems) {
        const optCountRow = await tx.get(
          `SELECT COUNT(*) AS count FROM part_supplier_options WHERE quote_item_id = ?`,
          [item.id],
        )
        if (Number(optCountRow?.count || 0) >= 2) continue

        const base = [
          { supplier: supplierRows[0], brand: 'BOSCH', cost: 120, markup: 45, eta: 'ON SHELF', selected: 0, available: 1, ordered: 0 },
          { supplier: supplierRows[1], brand: 'LUK', cost: 110, markup: 50, eta: 'TOMORROW', selected: 1, available: 1, ordered: 1 },
        ]
        if (supplierRows[2]) {
          base.push({
            supplier: supplierRows[2],
            brand: 'OEM',
            cost: 150,
            markup: 35,
            eta: '3 DAYS',
            selected: 0,
            available: 0,
            ordered: 0,
          })
        }

        for (const option of base) {
          const exists = await tx.get(
            `SELECT id FROM part_supplier_options WHERE quote_item_id = ? AND supplier_id = ? LIMIT 1`,
            [item.id, option.supplier.id],
          )
          if (exists?.id) continue
          const sell = roundMoney(option.cost * (1 + option.markup / 100))
          await tx.run(
            `INSERT INTO part_supplier_options (
              quote_item_id, supplier_id, brand, part_number,
              cost_price, sell_price, markup_percent, vat_rate, eta_text,
              is_available, is_ordered, is_selected
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.2, ?, ?, ?, ?)`,
            [
              item.id,
              option.supplier.id,
              option.brand,
              `DEMO-${item.id}-${option.supplier.id}`,
              option.cost,
              sell,
              option.markup,
              option.eta,
              option.available,
              option.ordered,
              option.selected,
            ],
          )
          seededSupplierOptions += 1
        }
      }
    }

    return {
      ok: true,
      inserted: {
        suppliers: createdSuppliers,
        service_templates: serviceTemplates.inserted,
        job_statuses: jobStatuses.inserted,
        predefined_quote_items: predefinedQuoteItems.inserted,
        document_templates: documentTemplates.inserted,
        customers: customersCount === 0 ? customerIds.length : 0,
        vehicles: vehiclesCount === 0 ? vehicleIds.length : 0,
        quotes: seededQuotes,
        parts_orders: seededPartsOrders,
        supplier_options: seededSupplierOptions,
        company_settings: seededCompanySettings,
        technicians: seededTechnicians,
        users: defaultAdmin.created ? 1 : 0,
        users_warning: defaultAdmin.warning,
        mot_events: seededMotEvents,
      },
    }
  })
}

module.exports = {
  seedDatabase,
}
