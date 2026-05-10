'use strict'

const express = require('express')

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function truthy(value) {
  const v = String(value || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

function pad4(n) {
  return String(n).padStart(4, '0')
}

async function ensureJobExists(db, jobId) {
  const row = await db.get(`SELECT id FROM jobs WHERE id = ?`, [jobId])
  return Boolean(row && row.id)
}

async function generateQuoteNumber(tx) {
  const year = new Date().getFullYear()
  const prefix = `Q-${year}-`

  // Lock the latest row to reduce the chance of duplicates in concurrent requests.
  const last = await tx.get(
    `SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    [`${prefix}%`],
  )

  let next = 1
  if (last && last.quote_number) {
    const m = String(last.quote_number).match(/Q-\d{4}-(\d{4})$/)
    if (m && m[1]) next = Number(m[1]) + 1
  }

  return `${prefix}${pad4(next)}`
}

function createJobsRouter({ db }) {
  const router = express.Router()

  router.get('/jobs', async (req, res) => {
    const q = String(req.query.q || '').trim()
    const statusFilter = String(req.query.status || '').trim().toLowerCase()
    const needsQuote = truthy(req.query.needs_quote)

    try {
      const params = []
      const where = []

      if (q) {
        where.push(
          `(
            v.registration LIKE ?
            OR c.first_name LIKE ?
            OR c.surname LIKE ?
            OR c.phone LIKE ?
            OR j.title LIKE ?
          )`,
        )
        const like = `%${q}%`
        params.push(like, like, like, like, like)
      }

      if (statusFilter) {
        where.push(`LOWER(j.status) = ?`)
        params.push(statusFilter)
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const rows = await db.all(
        `
        SELECT
          j.id,
          j.status,
          j.priority,
          j.title,
          j.booked_start,
          j.booked_end,
          j.requested_date,
          st.name AS service_template_name,
          v.id AS vehicle_id,
          v.registration AS vehicle_registration,
          v.make AS vehicle_make,
          v.model AS vehicle_model,
          c.id AS customer_id,
          c.first_name AS customer_first_name,
          c.surname AS customer_surname,
          qagg.quote_count,
          qagg.latest_quote_id,
          qagg.latest_quote_number,
          qagg.latest_quote_status,
          poagg.parts_count,
          poagg.parts_to_order,
          poagg.parts_waiting,
          poagg.parts_received,
          poagg.parts_issue
        FROM jobs j
        JOIN customers c ON c.id = j.customer_id
        JOIN vehicles v ON v.id = j.vehicle_id
        JOIN service_templates st ON st.id = j.service_template_id
        LEFT JOIN (
          SELECT
            job_id,
            COUNT(*) AS quote_count,
            CAST(SUBSTRING_INDEX(GROUP_CONCAT(id ORDER BY updated_at DESC SEPARATOR ','), ',', 1) AS UNSIGNED) AS latest_quote_id,
            SUBSTRING_INDEX(GROUP_CONCAT(quote_number ORDER BY updated_at DESC SEPARATOR ','), ',', 1) AS latest_quote_number,
            SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY updated_at DESC SEPARATOR ','), ',', 1) AS latest_quote_status
          FROM quotes
          WHERE job_id IS NOT NULL
          GROUP BY job_id
        ) qagg ON qagg.job_id = j.id
        LEFT JOIN (
          SELECT
            job_id,
            COUNT(*) AS parts_count,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS parts_to_order,
            SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) AS parts_waiting,
            SUM(CASE WHEN status IN ('received','credited') THEN 1 ELSE 0 END) AS parts_received,
            SUM(CASE WHEN status IN ('return_required','returned','credit_pending') THEN 1 ELSE 0 END) AS parts_issue
          FROM parts_orders
          WHERE job_id IS NOT NULL
          GROUP BY job_id
        ) poagg ON poagg.job_id = j.id
        ${whereSql}
        ORDER BY COALESCE(j.booked_start, CONCAT(j.requested_date, ' 00:00:00')) DESC, j.id DESC
        LIMIT 300
      `,
        params,
      )

      const jobs = (rows || []).map((r) => ({
        ...r,
        quote_count: Number(r.quote_count || 0),
        quote_exists: Number(r.quote_count || 0) > 0,
        parts_count: Number(r.parts_count || 0),
        parts_to_order: Number(r.parts_to_order || 0),
        parts_waiting: Number(r.parts_waiting || 0),
        parts_received: Number(r.parts_received || 0),
        parts_issue: Number(r.parts_issue || 0),
      }))

      for (const j of jobs) {
        if (!j.parts_count) {
          j.parts_status = 'no parts'
        } else if (j.parts_issue > 0) {
          j.parts_status = 'issue/return'
        } else if (j.parts_to_order > 0) {
          j.parts_status = 'to order'
        } else if (j.parts_waiting > 0) {
          j.parts_status = 'waiting'
        } else if (j.parts_received > 0) {
          j.parts_status = 'received'
        } else {
          j.parts_status = 'in progress'
        }
      }

      const filtered = needsQuote ? jobs.filter((j) => !j.quote_exists) : jobs

      res.json({ ok: true, jobs: filtered })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load jobs.' })
    }
  })

  router.get('/jobs/:id', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })

    try {
      const job = await db.get(
        `
        SELECT
          j.*,
          st.name AS service_template_name,
          st.is_mot AS service_is_mot,
          v.registration AS vehicle_registration,
          v.make AS vehicle_make,
          v.model AS vehicle_model,
          c.first_name AS customer_first_name,
          c.surname AS customer_surname,
          c.phone AS customer_phone
        FROM jobs j
        JOIN service_templates st ON st.id = j.service_template_id
        JOIN vehicles v ON v.id = j.vehicle_id
        JOIN customers c ON c.id = j.customer_id
        WHERE j.id = ?
      `,
        [jobId],
      )

      if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' })

      const quotes = await db.all(
        `
        SELECT id, quote_number, status, title, total_sell, updated_at
        FROM quotes
        WHERE job_id = ?
        ORDER BY updated_at DESC, id DESC
      `,
        [jobId],
      )

      const partsOrders = await db.all(
        `
        SELECT
          po.id,
          po.status,
          po.part_name,
          po.description,
          po.brand,
          po.part_number,
          po.quantity,
          po.cost_ex_vat,
          po.sell_ex_vat,
          po.vat_rate,
          po.eta_text,
          po.eta_datetime,
          po.expected_at,
          po.supplier_invoice_number,
          po.delivery_note_number,
          po.return_status,
          po.credit_note_number,
          po.updated_at,
          po.quote_id,
          q.quote_number,
          s.name AS supplier_name
        FROM parts_orders po
        LEFT JOIN quotes q ON q.id = po.quote_id
        LEFT JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.job_id = ?
        ORDER BY po.updated_at DESC, po.id DESC
        LIMIT 200
      `,
        [jobId],
      )

      res.json({
        ok: true,
        job,
        quotes: quotes || [],
        parts_orders: partsOrders || [],
        quote_count: (quotes || []).length,
        quote_exists: (quotes || []).length > 0,
      })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load job.' })
    }
  })

  router.get('/jobs/:id/job-sheet', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    try {
      const job = await db.get(
        `
        SELECT
          j.id, j.title, j.status, j.priority, j.booked_start, j.booked_end, j.estimated_duration_minutes,
          j.notes_customer_words, j.notes_internal, j.mileage_in, j.mileage_out, j.technician_name,
          j.job_checklist, j.technician_notes, j.extra_work_found, j.final_checks,
          v.registration, v.make, v.model,
          c.first_name, c.surname, c.phone
        FROM jobs j
        JOIN vehicles v ON v.id = j.vehicle_id
        JOIN customers c ON c.id = j.customer_id
        WHERE j.id = ?
      `,
        [jobId],
      )
      if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' })

      const quote = await db.get(
        `SELECT id, quote_number, status FROM quotes WHERE job_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
        [jobId],
      )
      const parts = await db.all(
        `SELECT part_name, description, quantity, status FROM parts_orders WHERE job_id = ? ORDER BY id ASC`,
        [jobId],
      )
      res.json({ ok: true, job, quote: quote || null, parts: parts || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load job sheet.' })
    }
  })

  router.get('/jobs/:id/technicians', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    try {
      if (!(await ensureJobExists(db, jobId))) {
        return res.status(404).json({ ok: false, error: 'Job not found.' })
      }
      const assignments = await db.all(
        `SELECT
          a.id,
          a.job_id,
          a.technician_id,
          a.assignment_role,
          a.estimated_hours,
          a.actual_hours,
          a.status,
          a.assigned_at,
          a.completed_at,
          a.created_at,
          a.updated_at,
          t.name AS technician_name,
          t.email AS technician_email,
          t.phone AS technician_phone,
          t.role_title AS technician_role_title,
          t.skills_notes AS technician_skills_notes,
          t.active AS technician_active
        FROM job_technician_assignments a
        JOIN technicians t ON t.id = a.technician_id
        WHERE a.job_id = ?
        ORDER BY a.assigned_at DESC, a.id DESC`,
        [jobId],
      )
      res.json({ ok: true, assignments: assignments || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load job technicians.' })
    }
  })

  router.post('/jobs/:id/technicians', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    const body = req.body || {}
    const technicianId = toInt(body.technician_id, 0)
    if (!technicianId) return res.status(400).json({ ok: false, error: 'technician_id is required.' })
    const assignmentRole = String(body.assignment_role || '').trim() || null
    const estimatedHours = body.estimated_hours == null || body.estimated_hours === '' ? null : Number(body.estimated_hours)
    const actualHours = body.actual_hours == null || body.actual_hours === '' ? null : Number(body.actual_hours)
    const status = String(body.status || 'assigned').trim().toLowerCase()
    if (estimatedHours != null && !Number.isFinite(estimatedHours)) return res.status(400).json({ ok: false, error: 'estimated_hours must be numeric.' })
    if (actualHours != null && !Number.isFinite(actualHours)) return res.status(400).json({ ok: false, error: 'actual_hours must be numeric.' })
    try {
      if (!(await ensureJobExists(db, jobId))) {
        return res.status(404).json({ ok: false, error: 'Job not found.' })
      }
      const tech = await db.get(`SELECT id FROM technicians WHERE id = ?`, [technicianId])
      if (!tech) return res.status(404).json({ ok: false, error: 'Technician not found.' })
      const created = await db.run(
        `INSERT INTO job_technician_assignments
         (job_id, technician_id, assignment_role, estimated_hours, actual_hours, status, assigned_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
        [jobId, technicianId, assignmentRole, estimatedHours, actualHours, status, status === 'completed' ? new Date() : null],
      )
      const assignment = await db.get(`SELECT * FROM job_technician_assignments WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, assignment })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to assign technician.' })
    }
  })

  router.patch('/jobs/:id/technicians/:assignmentId', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    const assignmentId = toInt(req.params.assignmentId, 0)
    if (!jobId || !assignmentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM job_technician_assignments WHERE id = ? AND job_id = ?`, [assignmentId, jobId])
      if (!row) return res.status(404).json({ ok: false, error: 'Assignment not found.' })
      const nextStatus = body.status != null ? String(body.status).trim().toLowerCase() : row.status
      const next = {
        technician_id: body.technician_id != null ? toInt(body.technician_id, row.technician_id) : row.technician_id,
        assignment_role: body.assignment_role != null ? String(body.assignment_role).trim() || null : row.assignment_role,
        estimated_hours: body.estimated_hours != null ? (body.estimated_hours === '' ? null : Number(body.estimated_hours)) : row.estimated_hours,
        actual_hours: body.actual_hours != null ? (body.actual_hours === '' ? null : Number(body.actual_hours)) : row.actual_hours,
        status: nextStatus,
      }
      if (next.estimated_hours != null && !Number.isFinite(next.estimated_hours)) return res.status(400).json({ ok: false, error: 'estimated_hours must be numeric.' })
      if (next.actual_hours != null && !Number.isFinite(next.actual_hours)) return res.status(400).json({ ok: false, error: 'actual_hours must be numeric.' })
      await db.run(
        `UPDATE job_technician_assignments
         SET technician_id = ?, assignment_role = ?, estimated_hours = ?, actual_hours = ?, status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.technician_id, next.assignment_role, next.estimated_hours, next.actual_hours, next.status, next.status === 'completed' ? new Date() : row.completed_at, assignmentId],
      )
      const updated = await db.get(`SELECT * FROM job_technician_assignments WHERE id = ?`, [assignmentId])
      res.json({ ok: true, assignment: updated })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update assignment.' })
    }
  })

  router.delete('/jobs/:id/technicians/:assignmentId', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    const assignmentId = toInt(req.params.assignmentId, 0)
    if (!jobId || !assignmentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    try {
      await db.run(`DELETE FROM job_technician_assignments WHERE id = ? AND job_id = ?`, [assignmentId, jobId])
      res.json({ ok: true })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to remove assignment.' })
    }
  })

  router.get('/jobs/:id/activity', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    try {
      if (!(await ensureJobExists(db, jobId))) {
        return res.status(404).json({ ok: false, error: 'Job not found.' })
      }
      const events = await db.all(
        `SELECT
          e.id, e.job_id, e.technician_id, e.event_type, e.title, e.description, e.metadata_json, e.created_at,
          t.name AS technician_name
         FROM job_activity_events e
         LEFT JOIN technicians t ON t.id = e.technician_id
         WHERE e.job_id = ?
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT 200`,
        [jobId],
      )
      res.json({ ok: true, events: events || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load job activity.' })
    }
  })

  router.post('/jobs/:id/activity', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    const body = req.body || {}
    const eventType = String(body.event_type || '').trim().toLowerCase()
    const title = String(body.title || '').trim()
    const description = body.description != null ? String(body.description).trim() : null
    const technicianId = body.technician_id != null && body.technician_id !== '' ? toInt(body.technician_id, 0) : null
    const metadataJson = body.metadata_json != null ? JSON.stringify(body.metadata_json) : null
    if (!eventType || !title) return res.status(400).json({ ok: false, error: 'event_type and title are required.' })
    if (technicianId != null && !technicianId) return res.status(400).json({ ok: false, error: 'Invalid technician_id.' })
    try {
      if (!(await ensureJobExists(db, jobId))) {
        return res.status(404).json({ ok: false, error: 'Job not found.' })
      }
      if (technicianId) {
        const tech = await db.get(`SELECT id FROM technicians WHERE id = ?`, [technicianId])
        if (!tech) return res.status(404).json({ ok: false, error: 'Technician not found.' })
      }
      const created = await db.run(
        `INSERT INTO job_activity_events (job_id, technician_id, event_type, title, description, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [jobId, technicianId, eventType, title, description, metadataJson],
      )
      const event = await db.get(`SELECT * FROM job_activity_events WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, event })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to add job activity event.' })
    }
  })

  router.post('/jobs/:id/quotes', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })

    const forceNew = truthy(req.query.force_new) || truthy((req.body || {}).force_new)

    try {
      const out = await db.transaction(async (tx) => {
        const job = await tx.get(
          `
          SELECT
            j.id,
            j.title,
            j.customer_id,
            j.vehicle_id,
            st.name AS service_template_name
          FROM jobs j
          JOIN service_templates st ON st.id = j.service_template_id
          WHERE j.id = ?
        `,
          [jobId],
        )
        if (!job) {
          const err = new Error('Job not found.')
          err.status = 404
          throw err
        }

        const existing = await tx.get(
          `
          SELECT id, quote_number, status, title, updated_at, revision_number
          FROM quotes
          WHERE job_id = ?
          ORDER BY updated_at DESC, id DESC
          LIMIT 1
        `,
          [jobId],
        )

        const existingStatus = String(existing && existing.status ? existing.status : '').toLowerCase()
        if (existing && !forceNew && existingStatus !== 'accepted') {
          return { quote: existing, reused: true }
        }

        const titleBase =
          String(job.title || '').trim() ||
          String(job.service_template_name || 'Job').trim()
        const title =
          existing && existingStatus === 'accepted'
            ? `${titleBase} - ADDITIONAL WORK`
            : titleBase

        const quoteNumber = await generateQuoteNumber(tx)
        const sourceQuoteId = existing && existingStatus === 'accepted' ? existing.id : null
        const nextRevision = sourceQuoteId
          ? Math.max(2, Number(existing.revision_number || 1) + 1)
          : 1
        const created = await tx.run(
          `INSERT INTO quotes (
            quote_number, customer_id, vehicle_id, job_id, status, title,
            parent_quote_id, supersedes_quote_id, revision_number, revision_reason,
            subtotal_cost, subtotal_sell, vat_rate, vat_amount, total_sell, estimated_margin
          ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 0, 0, 0.2000, 0, 0, 0)`,
          [
            quoteNumber,
            job.customer_id,
            job.vehicle_id,
            job.id,
            title,
            sourceQuoteId ? sourceQuoteId : null,
            sourceQuoteId,
            nextRevision,
            sourceQuoteId ? 'Additional work discovered after acceptance' : null,
          ],
        )

        const quote = await tx.get(
          `SELECT id, quote_number, status, title, updated_at FROM quotes WHERE id = ?`,
          [created.lastInsertId],
        )

        return { quote, reused: false }
      })

      res.status(out.reused ? 200 : 201).json({ ok: true, ...out })
    } catch (err) {
      const status = err && err.status ? err.status : 500
      res.status(status).json({ ok: false, error: err.message || 'Failed to create quote.' })
    }
  })

  return router
}

module.exports = {
  createJobsRouter,
}
