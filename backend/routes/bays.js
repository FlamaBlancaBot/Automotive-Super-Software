'use strict'

const express = require('express')

function toInt(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function toText(value) {
  if (value == null) return ''
  return String(value).trim()
}

const BAY_TYPES = new Set(['general', 'mot', 'diagnostic', 'engine', 'storage', 'other'])

function createBaysRouter({ db }) {
  const router = express.Router()

  router.get('/bays', async (_req, res) => {
    try {
      const bays = await db.all(
        `SELECT id, name, bay_type, description, active, is_mot_bay, created_at, updated_at
         FROM workshop_bays
         ORDER BY active DESC, name ASC`,
      )
      res.json({ ok: true, bays: bays || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load bays.' })
    }
  })

  router.post('/bays', async (req, res) => {
    const body = req.body || {}
    const name = toText(body.name)
    if (!name) return res.status(400).json({ ok: false, error: 'Bay name is required.' })
    const bayTypeRaw = toText(body.bay_type || 'general').toLowerCase()
    const bayType = BAY_TYPES.has(bayTypeRaw) ? bayTypeRaw : 'other'
    const description = body.description != null ? toText(body.description) || null : null
    const active = body.active === 0 || body.active === false ? 0 : 1
    const isMotBay = body.is_mot_bay === 1 || body.is_mot_bay === true ? 1 : 0
    try {
      const created = await db.run(
        `INSERT INTO workshop_bays (name, bay_type, description, active, is_mot_bay)
         VALUES (?, ?, ?, ?, ?)`,
        [name, bayType, description, active, isMotBay],
      )
      const bay = await db.get(`SELECT * FROM workshop_bays WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, bay })
    } catch (err) {
      const duplicate = err && err.code === 'ER_DUP_ENTRY'
      res.status(duplicate ? 400 : 500).json({ ok: false, error: duplicate ? 'Bay name already exists.' : 'Failed to create bay.' })
    }
  })

  router.patch('/bays/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid bay id.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM workshop_bays WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Bay not found.' })
      const bayTypeRaw = body.bay_type != null ? toText(body.bay_type).toLowerCase() : row.bay_type
      const next = {
        name: body.name != null ? toText(body.name) : row.name,
        bay_type: BAY_TYPES.has(bayTypeRaw) ? bayTypeRaw : 'other',
        description: body.description != null ? toText(body.description) || null : row.description,
        active: body.active != null ? (body.active ? 1 : 0) : row.active,
        is_mot_bay: body.is_mot_bay != null ? (body.is_mot_bay ? 1 : 0) : row.is_mot_bay,
      }
      if (!next.name) return res.status(400).json({ ok: false, error: 'Bay name is required.' })
      await db.run(
        `UPDATE workshop_bays
         SET name = ?, bay_type = ?, description = ?, active = ?, is_mot_bay = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.name, next.bay_type, next.description, next.active, next.is_mot_bay, id],
      )
      const updated = await db.get(`SELECT * FROM workshop_bays WHERE id = ?`, [id])
      res.json({ ok: true, bay: updated })
    } catch (err) {
      const duplicate = err && err.code === 'ER_DUP_ENTRY'
      res.status(duplicate ? 400 : 500).json({ ok: false, error: duplicate ? 'Bay name already exists.' : 'Failed to update bay.' })
    }
  })

  router.get('/bays/:id/technicians', async (req, res) => {
    const bayId = toInt(req.params.id, 0)
    if (!bayId) return res.status(400).json({ ok: false, error: 'Invalid bay id.' })
    try {
      const rows = await db.all(
        `SELECT
          bta.id,
          bta.bay_id,
          bta.technician_id,
          bta.active,
          bta.created_at,
          bta.updated_at,
          t.name AS technician_name,
          t.role_title AS technician_role_title,
          t.active AS technician_active
         FROM bay_technician_assignments bta
         JOIN technicians t ON t.id = bta.technician_id
         WHERE bta.bay_id = ?
         ORDER BY bta.active DESC, t.name ASC`,
        [bayId],
      )
      res.json({ ok: true, assignments: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load bay technicians.' })
    }
  })

  router.post('/bays/:id/technicians', async (req, res) => {
    const bayId = toInt(req.params.id, 0)
    if (!bayId) return res.status(400).json({ ok: false, error: 'Invalid bay id.' })
    const body = req.body || {}
    const technicianId = toInt(body.technician_id, 0)
    if (!technicianId) return res.status(400).json({ ok: false, error: 'technician_id is required.' })
    try {
      const bay = await db.get(`SELECT id FROM workshop_bays WHERE id = ?`, [bayId])
      if (!bay) return res.status(404).json({ ok: false, error: 'Bay not found.' })
      const tech = await db.get(`SELECT id FROM technicians WHERE id = ?`, [technicianId])
      if (!tech) return res.status(404).json({ ok: false, error: 'Technician not found.' })
      await db.run(
        `INSERT INTO bay_technician_assignments (bay_id, technician_id, active)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE active = 1, updated_at = CURRENT_TIMESTAMP`,
        [bayId, technicianId],
      )
      const assignment = await db.get(
        `SELECT * FROM bay_technician_assignments WHERE bay_id = ? AND technician_id = ? LIMIT 1`,
        [bayId, technicianId],
      )
      res.status(201).json({ ok: true, assignment })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to assign technician to bay.' })
    }
  })

  router.delete('/bays/:id/technicians/:assignmentId', async (req, res) => {
    const bayId = toInt(req.params.id, 0)
    const assignmentId = toInt(req.params.assignmentId, 0)
    if (!bayId || !assignmentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    try {
      await db.run(
        `UPDATE bay_technician_assignments
         SET active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND bay_id = ?`,
        [assignmentId, bayId],
      )
      res.json({ ok: true })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to remove bay technician assignment.' })
    }
  })

  router.get('/jobs/:id/bay', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    try {
      const current = await db.get(
        `SELECT
          jba.*,
          wb.name AS bay_name,
          wb.bay_type,
          wb.is_mot_bay,
          wb.active AS bay_active
         FROM job_bay_assignments jba
         JOIN workshop_bays wb ON wb.id = jba.bay_id
         WHERE jba.job_id = ? AND jba.released_at IS NULL
         ORDER BY jba.assigned_at DESC, jba.id DESC
         LIMIT 1`,
        [jobId],
      )
      const history = await db.all(
        `SELECT
          jba.*,
          wb.name AS bay_name,
          wb.bay_type,
          wb.is_mot_bay
         FROM job_bay_assignments jba
         JOIN workshop_bays wb ON wb.id = jba.bay_id
         WHERE jba.job_id = ?
         ORDER BY jba.assigned_at DESC, jba.id DESC
         LIMIT 30`,
        [jobId],
      )
      res.json({ ok: true, current_assignment: current || null, assignments: history || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load job bay assignment.' })
    }
  })

  router.post('/jobs/:id/bay', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    if (!jobId) return res.status(400).json({ ok: false, error: 'Invalid job id.' })
    const body = req.body || {}
    const bayId = toInt(body.bay_id, 0)
    if (!bayId) return res.status(400).json({ ok: false, error: 'bay_id is required.' })
    const notes = body.notes != null ? toText(body.notes) || null : null
    try {
      const job = await db.get(`SELECT id FROM jobs WHERE id = ?`, [jobId])
      if (!job) return res.status(404).json({ ok: false, error: 'Job not found.' })
      const bay = await db.get(`SELECT id FROM workshop_bays WHERE id = ?`, [bayId])
      if (!bay) return res.status(404).json({ ok: false, error: 'Bay not found.' })

      await db.transaction(async (tx) => {
        await tx.run(
          `UPDATE job_bay_assignments
           SET released_at = CURRENT_TIMESTAMP, status = 'released', updated_at = CURRENT_TIMESTAMP
           WHERE job_id = ? AND released_at IS NULL`,
          [jobId],
        )
        await tx.run(
          `INSERT INTO job_bay_assignments (job_id, bay_id, assigned_at, status, notes)
           VALUES (?, ?, CURRENT_TIMESTAMP, 'assigned', ?)`,
          [jobId, bayId, notes],
        )
      })

      const current = await db.get(
        `SELECT jba.*, wb.name AS bay_name, wb.bay_type, wb.is_mot_bay
         FROM job_bay_assignments jba
         JOIN workshop_bays wb ON wb.id = jba.bay_id
         WHERE jba.job_id = ? AND jba.released_at IS NULL
         ORDER BY jba.id DESC
         LIMIT 1`,
        [jobId],
      )

      res.status(201).json({ ok: true, assignment: current })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to assign job to bay.' })
    }
  })

  router.patch('/jobs/:id/bay/:assignmentId', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    const assignmentId = toInt(req.params.assignmentId, 0)
    if (!jobId || !assignmentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM job_bay_assignments WHERE id = ? AND job_id = ?`, [assignmentId, jobId])
      if (!row) return res.status(404).json({ ok: false, error: 'Bay assignment not found.' })
      const nextStatus = body.status != null ? toText(body.status).toLowerCase() || row.status : row.status
      const nextNotes = body.notes != null ? toText(body.notes) || null : row.notes
      const releaseNow = body.released === true || nextStatus === 'released'
      await db.run(
        `UPDATE job_bay_assignments
         SET status = ?, notes = ?, released_at = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextStatus, nextNotes, releaseNow ? new Date() : row.released_at, assignmentId],
      )
      const updated = await db.get(`SELECT * FROM job_bay_assignments WHERE id = ?`, [assignmentId])
      res.json({ ok: true, assignment: updated })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update bay assignment.' })
    }
  })

  router.delete('/jobs/:id/bay/:assignmentId', async (req, res) => {
    const jobId = toInt(req.params.id, 0)
    const assignmentId = toInt(req.params.assignmentId, 0)
    if (!jobId || !assignmentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    try {
      await db.run(
        `UPDATE job_bay_assignments
         SET released_at = CURRENT_TIMESTAMP, status = 'released', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND job_id = ?`,
        [assignmentId, jobId],
      )
      res.json({ ok: true })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to release bay assignment.' })
    }
  })

  return router
}

module.exports = {
  createBaysRouter,
}
