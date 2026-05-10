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

function createTechnicianSkillsRouter({ db }) {
  const router = express.Router()

  router.get('/technician-skills', async (_req, res) => {
    try {
      const skills = await db.all(
        `SELECT id, name, description, active, created_at, updated_at
         FROM technician_skills
         ORDER BY active DESC, name ASC`,
      )
      res.json({ ok: true, skills: skills || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load technician skills.' })
    }
  })

  router.post('/technician-skills', async (req, res) => {
    const body = req.body || {}
    const name = toText(body.name)
    if (!name) return res.status(400).json({ ok: false, error: 'Skill name is required.' })
    const description = body.description != null ? toText(body.description) || null : null
    const active = body.active === 0 || body.active === false ? 0 : 1
    try {
      const created = await db.run(
        `INSERT INTO technician_skills (name, description, active)
         VALUES (?, ?, ?)`,
        [name, description, active],
      )
      const skill = await db.get(`SELECT * FROM technician_skills WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, skill })
    } catch (err) {
      const duplicate = err && err.code === 'ER_DUP_ENTRY'
      res.status(duplicate ? 400 : 500).json({ ok: false, error: duplicate ? 'Skill already exists.' : 'Failed to create skill.' })
    }
  })

  router.patch('/technician-skills/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid skill id.' })
    const body = req.body || {}
    try {
      const row = await db.get(`SELECT * FROM technician_skills WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Skill not found.' })
      const next = {
        name: body.name != null ? toText(body.name) : row.name,
        description: body.description != null ? toText(body.description) || null : row.description,
        active: body.active != null ? (body.active ? 1 : 0) : row.active,
      }
      if (!next.name) return res.status(400).json({ ok: false, error: 'Skill name is required.' })
      await db.run(
        `UPDATE technician_skills
         SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.name, next.description, next.active, id],
      )
      const updated = await db.get(`SELECT * FROM technician_skills WHERE id = ?`, [id])
      res.json({ ok: true, skill: updated })
    } catch (err) {
      const duplicate = err && err.code === 'ER_DUP_ENTRY'
      res.status(duplicate ? 400 : 500).json({ ok: false, error: duplicate ? 'Skill already exists.' : 'Failed to update skill.' })
    }
  })

  router.get('/technicians/:id/skills', async (req, res) => {
    const technicianId = toInt(req.params.id, 0)
    if (!technicianId) return res.status(400).json({ ok: false, error: 'Invalid technician id.' })
    try {
      const rows = await db.all(
        `SELECT
          tsa.id,
          tsa.technician_id,
          tsa.skill_id,
          tsa.level,
          tsa.notes,
          tsa.created_at,
          tsa.updated_at,
          ts.name AS skill_name,
          ts.description AS skill_description,
          ts.active AS skill_active
         FROM technician_skill_assignments tsa
         JOIN technician_skills ts ON ts.id = tsa.skill_id
         WHERE tsa.technician_id = ?
         ORDER BY ts.name ASC`,
        [technicianId],
      )
      res.json({ ok: true, assignments: rows || [] })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load technician skill assignments.' })
    }
  })

  router.post('/technicians/:id/skills', async (req, res) => {
    const technicianId = toInt(req.params.id, 0)
    if (!technicianId) return res.status(400).json({ ok: false, error: 'Invalid technician id.' })
    const body = req.body || {}
    const skillId = toInt(body.skill_id, 0)
    if (!skillId) return res.status(400).json({ ok: false, error: 'skill_id is required.' })
    const level = body.level != null ? toText(body.level) || null : null
    const notes = body.notes != null ? toText(body.notes) || null : null
    try {
      const tech = await db.get(`SELECT id FROM technicians WHERE id = ?`, [technicianId])
      if (!tech) return res.status(404).json({ ok: false, error: 'Technician not found.' })
      const skill = await db.get(`SELECT id FROM technician_skills WHERE id = ?`, [skillId])
      if (!skill) return res.status(404).json({ ok: false, error: 'Skill not found.' })
      const created = await db.run(
        `INSERT INTO technician_skill_assignments (technician_id, skill_id, level, notes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE level = VALUES(level), notes = VALUES(notes), updated_at = CURRENT_TIMESTAMP`,
        [technicianId, skillId, level, notes],
      )
      let assignmentId = created.lastInsertId
      if (!assignmentId) {
        const existing = await db.get(
          `SELECT id FROM technician_skill_assignments WHERE technician_id = ? AND skill_id = ? LIMIT 1`,
          [technicianId, skillId],
        )
        assignmentId = existing ? existing.id : 0
      }
      const assignment = await db.get(`SELECT * FROM technician_skill_assignments WHERE id = ?`, [assignmentId])
      res.status(201).json({ ok: true, assignment })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to assign skill to technician.' })
    }
  })

  router.delete('/technicians/:id/skills/:assignmentId', async (req, res) => {
    const technicianId = toInt(req.params.id, 0)
    const assignmentId = toInt(req.params.assignmentId, 0)
    if (!technicianId || !assignmentId) return res.status(400).json({ ok: false, error: 'Invalid ids.' })
    try {
      await db.run(`DELETE FROM technician_skill_assignments WHERE id = ? AND technician_id = ?`, [assignmentId, technicianId])
      res.json({ ok: true })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to remove skill assignment.' })
    }
  })

  return router
}

module.exports = {
  createTechnicianSkillsRouter,
}
