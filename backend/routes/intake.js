'use strict'

const express = require('express')
const {
  normaliseRegistration,
  toOperationalUpper,
  cleanPhone,
  combineLocalDateAndTime,
  addMinutesToDateTime,
} = require('../db/utils')
const { logActivity } = require('../lib/activity')

function isLikelyPhoneNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10
}

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function createIntakeRouter({ db }) {
  const router = express.Router()

  router.post('/intake', async (req, res) => {
    const body = req.body || {}

    const customer = body.customer || {}
    const vehicle = body.vehicle || {}
    const booking = body.booking || {}
    const notes = body.notes || {}

    const firstName = toOperationalUpper(customer.first_name)
    const surname = toOperationalUpper(customer.surname)
    const phone = cleanPhone(customer.phone)

  const registrationRaw = String(vehicle.registration || '').trim()
  const registrationNorm = normaliseRegistration(registrationRaw)
  const manualVehicle = {
    make: vehicle.make ? toOperationalUpper(vehicle.make) : null,
    model: vehicle.model ? toOperationalUpper(vehicle.model) : null,
    year: vehicle.year ? String(vehicle.year).trim() : null,
    fuel_type: vehicle.fuel_type ? toOperationalUpper(vehicle.fuel_type) : null,
    engine_size: vehicle.engine_size ? toOperationalUpper(vehicle.engine_size) : null,
    colour: vehicle.colour ? toOperationalUpper(vehicle.colour) : null,
  }

    const serviceTemplateId = toInt(body.service_template_id, null)

    if (!firstName || !surname || !phone || !isLikelyPhoneNumber(phone)) {
      return res.status(400).json({
        ok: false,
        error:
          'Customer first name, surname, and a valid phone number are required.',
      })
    }
    if (!registrationNorm) {
      return res
        .status(400)
        .json({ ok: false, error: 'Vehicle registration is required.' })
    }
    if (!serviceTemplateId) {
      return res
        .status(400)
        .json({ ok: false, error: 'service_template_id is required.' })
    }

    try {
      const result = await handleIntakeMysql(db, {
        customer,
        firstName,
        surname,
        phone,
        registrationNorm,
        serviceTemplateId,
        booking,
        notes,
        reminders: body.reminders || null,
        title: body.title,
        manualVehicle,
      })

      const job = result && result.job ? result.job : null
      await logActivity(db, {
        userId: req.authUser ? req.authUser.id : null,
        entityType: 'job',
        entityId: job ? job.id : null,
        action: 'intake_created',
        summary: `INTAKE CREATED FOR ${job ? job.registration : registrationNorm}`,
        metadata: { source: 'intake' },
      })
      res.status(201).json({
        ok: true,
        ...result,
        job_id: job ? job.id : null,
        customer_id: job ? job.customer_id : null,
        vehicle_id: job ? job.vehicle_id : null,
        registration: job ? job.registration : null,
        make: job ? job.vehicle_make : null,
        model: job ? job.vehicle_model : null,
        quote_exists: false,
        next: {
          action: 'create_quote',
          message: 'Next step: create a quote for this job.',
        },
      })
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: 'Failed to create intake.',
        details: String(err && err.message ? err.message : err),
      })
    }
  })

  return router
}

async function handleIntakeMysql(db, input) {
  return db.transaction((tx) => handleIntakeCommonAsync(tx, input))
}

async function handleIntakeCommonAsync(tx, input) {
  const {
    customer,
    firstName,
    surname,
    phone,
    registrationNorm,
    serviceTemplateId,
    booking,
    notes,
    reminders,
    title,
    manualVehicle,
  } = input

  const serviceTemplate = await tx.get(
    'SELECT * FROM service_templates WHERE id = ? AND active = 1',
    [serviceTemplateId],
  )

  if (!serviceTemplate) {
    const err = new Error('Selected service template not found.')
    err.status = 400
    throw err
  }

  const customerEmail = customer.email ? String(customer.email).trim() : null
  const customerPostcode = customer.postcode
    ? toOperationalUpper(customer.postcode)
    : null
  const customerAddress = customer.address
    ? toOperationalUpper(customer.address)
    : null

  let customerRow = null
  if (customer.id) {
    customerRow = await tx.get(
      'SELECT id, first_name, surname, phone FROM customers WHERE id = ?',
      [toInt(customer.id, 0)],
    )
  }

  if (!customerRow) {
    const phoneDigits = phone.replace(/\D/g, '')
    if (phoneDigits) {
      customerRow = await tx.get(
        `
        SELECT id, first_name, surname, phone
        FROM customers
        WHERE replace(replace(phone, ' ', ''), '+', '') = ?
        LIMIT 1
      `,
        [phoneDigits],
      )
    }

    if (!customerRow) {
      const created = await tx.run(
        `INSERT INTO customers (
          first_name, surname, phone, email, postcode, address, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [firstName, surname, phone, customerEmail, customerPostcode, customerAddress],
      )
      customerRow = await tx.get(
        'SELECT id, first_name, surname, phone FROM customers WHERE id = ?',
        [created.lastInsertId],
      )
    }
  }
  if (customerRow) {
    await tx.run(
      `UPDATE customers
       SET first_name = ?, surname = ?, phone = ?,
           email = COALESCE(?, email),
           postcode = COALESCE(?, postcode),
           address = COALESCE(?, address),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        firstName,
        surname,
        phone,
        customerEmail,
        customerPostcode,
        customerAddress,
        customerRow.id,
      ],
    )
  }

  let vehicleRow = await tx.get(
    `
    SELECT *
    FROM vehicles
    WHERE upper(replace(registration, ' ', '')) = ?
    LIMIT 1
  `,
    [registrationNorm],
  )

  if (!vehicleRow) {
    const created = await tx.run(
      `INSERT INTO vehicles (registration, make, model, year, fuel_type, engine_size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        registrationNorm,
        manualVehicle?.make || null,
        manualVehicle?.model || null,
        manualVehicle?.year || null,
        manualVehicle?.fuel_type || null,
        manualVehicle?.engine_size || null,
        manualVehicle?.colour || null,
      ],
    )
    vehicleRow = await tx.get('SELECT * FROM vehicles WHERE id = ?', [
      created.lastInsertId,
    ])
  }
  if (vehicleRow && manualVehicle) {
    await tx.run(
      `UPDATE vehicles
       SET make = COALESCE(?, make), model = COALESCE(?, model), year = COALESCE(?, year),
           fuel_type = COALESCE(?, fuel_type), engine_size = COALESCE(?, engine_size), colour = COALESCE(?, colour),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        manualVehicle.make,
        manualVehicle.model,
        manualVehicle.year,
        manualVehicle.fuel_type,
        manualVehicle.engine_size,
        manualVehicle.colour,
        vehicleRow.id,
      ],
    )
    vehicleRow = await tx.get(`SELECT * FROM vehicles WHERE id = ?`, [vehicleRow.id])
  }

  const currentOwner = await tx.get(
    `
    SELECT customer_id
    FROM customer_vehicles
    WHERE vehicle_id = ? AND is_current_owner = 1
    ORDER BY created_at DESC
    LIMIT 1
  `,
    [vehicleRow.id],
  )

  if (!currentOwner || currentOwner.customer_id !== customerRow.id) {
    await tx.run(
      `UPDATE customer_vehicles
       SET is_current_owner = 0
       WHERE vehicle_id = ? AND is_current_owner = 1`,
      [vehicleRow.id],
    )

    await tx.run(
      `INSERT INTO customer_vehicles (customer_id, vehicle_id, relationship_status, is_current_owner, created_at)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      [customerRow.id, vehicleRow.id, 'keeper'],
    )
  }

  let status = String(booking.status || 'new').trim().toLowerCase()
  const priority = String(booking.priority || 'normal').trim().toLowerCase()

  const requestedDate = booking.requested_date
    ? String(booking.requested_date)
    : null
  const arrivalTime = booking.arrival_time ? String(booking.arrival_time) : null

  const estimatedDuration = toInt(
    booking.estimated_duration_minutes,
    serviceTemplate.default_duration_minutes || 60,
  )
  const durationMargin = toInt(booking.duration_margin_minutes, 15)

  const bookedStart =
    requestedDate && arrivalTime
      ? combineLocalDateAndTime(requestedDate, arrivalTime)
      : null
  const bookedEnd = bookedStart
    ? addMinutesToDateTime(bookedStart, estimatedDuration)
    : null

  const jobTitle = title
    ? toOperationalUpper(title)
    : `${toOperationalUpper(serviceTemplate.name)} - ${toOperationalUpper(vehicleRow.registration)}`

  const mot = booking.mot || {}
  const motIsExternal = mot.is_external ? 1 : 0
  const motTime = mot.time ? combineLocalDateAndTime(requestedDate, mot.time) : null
  const motType = motIsExternal ? 'offsite' : 'onsite'
  const motExpectedDuration = 45
  if (serviceTemplate.is_mot && motTime && (status === 'new' || status === 'booked')) {
    status = 'mot_booked'
  }

  const jobInsert = await tx.run(
    `INSERT INTO jobs (
      customer_id, vehicle_id, service_template_id,
      title, status, priority,
      requested_date, booked_start, booked_end,
      estimated_duration_minutes, duration_margin_minutes,
      mot_supplier_name, mot_supplier_contact, mot_time, mot_is_external,
      notes_customer_words, notes_internal,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )`,
    [
      customerRow.id,
      vehicleRow.id,
      serviceTemplate.id,
      jobTitle,
      status,
      priority,
      requestedDate,
      bookedStart,
      bookedEnd,
      estimatedDuration,
      durationMargin,
      mot.supplier_name ? toOperationalUpper(mot.supplier_name) : null,
      mot.supplier_contact ? toOperationalUpper(mot.supplier_contact) : null,
      motTime,
      motIsExternal,
      notes.customer_words ? String(notes.customer_words).trim() : null,
      notes.internal ? toOperationalUpper(notes.internal) : null,
    ],
  )

  const jobId = jobInsert.lastInsertId

  if (serviceTemplate.is_mot && motIsExternal && motTime) {
    const reminderOffsets = [-30, -15, -5]
    const enabledOffsets = Array.isArray(reminders?.offset_minutes)
      ? reminders.offset_minutes.map((x) => Number(x))
      : reminderOffsets

    for (const offset of reminderOffsets) {
      if (!enabledOffsets.includes(offset)) continue
      const remindAt = addMinutesToDateTime(motTime, offset)
      if (!remindAt) continue

      await tx.run(
        `INSERT INTO reminders (job_id, reminder_type, remind_at, offset_minutes, enabled, created_at)
         VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [jobId, 'external_mot', remindAt, offset],
      )
    }
  }

  if (serviceTemplate.is_mot) {
    await tx.run(
      `INSERT INTO mot_events (
         job_id, vehicle_id, supplier_id, mot_type, mot_time, expected_duration_minutes, status, result
       )
       VALUES (?, ?, NULL, ?, ?, ?, ?, NULL)`,
      [
        jobId,
        vehicleRow.id,
        motType,
        motTime,
        motExpectedDuration,
        motIsExternal ? 'booked' : 'in_progress',
      ],
    )

    await tx.run(
      `INSERT INTO mot_result_checks (job_id, vehicle_id, registration, booked_start, status)
       VALUES (?, ?, ?, ?, 'booked')`,
      [jobId, vehicleRow.id, normaliseRegistration(vehicleRow.registration), motTime || bookedStart || null],
    ).catch(() => {})
  }

  const jobRow = await tx.get(
    `
    SELECT j.id, j.title, j.status, j.priority, j.requested_date, j.booked_start, j.booked_end,
           j.estimated_duration_minutes, j.mot_is_external, j.mot_time,
           c.id as customer_id, c.first_name, c.surname, c.phone,
           v.id as vehicle_id, v.registration, v.make as vehicle_make, v.model as vehicle_model,
           st.id as service_template_id, st.name as service_name
    FROM jobs j
    JOIN customers c ON c.id = j.customer_id
    JOIN vehicles v ON v.id = j.vehicle_id
    JOIN service_templates st ON st.id = j.service_template_id
    WHERE j.id = ?
  `,
    [jobId],
  )

  return { customer: customerRow, vehicle: vehicleRow, job: jobRow }
}

module.exports = {
  createIntakeRouter,
}
