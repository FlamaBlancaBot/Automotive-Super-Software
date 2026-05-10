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

function mapTechnicianRow(row) {
  if (!row) return null
  return {
    ...row,
    role: row.role_title || null,
    skills_notes: row.skills_notes != null ? row.skills_notes : row.capabilities || null,
  }
}

function createTechniciansRouter({ db }) {
  const router = express.Router()

  router.get('/technicians', async (_req, res) => {
    try {
      const rows = await db.all(
        `SELECT id, name, email, phone, role_title, skills_notes, capabilities, active, created_at, updated_at
         FROM technicians
         ORDER BY active DESC, name ASC`,
      )
      res.json({ ok: true, technicians: (rows || []).map(mapTechnicianRow) })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load technicians.' })
    }
  })

  router.post('/technicians', async (req, res) => {
    const body = req.body || {}
    const name = toText(body.name)
    if (!name) return res.status(400).json({ ok: false, error: 'Technician name is required.' })

    const capabilities = body.capabilities != null ? toText(body.capabilities) || null : null
    const skillsNotes = body.skills_notes != null ? toText(body.skills_notes) || null : capabilities
    const roleTitle =
      body.role_title != null
        ? toText(body.role_title) || null
        : body.role != null
          ? toText(body.role) || null
          : null
    const email = body.email != null ? String(body.email).trim() || null : null
    const phone = body.phone != null ? String(body.phone).trim() || null : null
    const active = body.active === 0 || body.active === false ? 0 : 1

    try {
      const created = await db.run(
        `INSERT INTO technicians (name, email, phone, role_title, skills_notes, capabilities, active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, email, phone, roleTitle, skillsNotes, capabilities, active],
      )
      const row = await db.get(`SELECT * FROM technicians WHERE id = ?`, [created.lastInsertId])
      res.status(201).json({ ok: true, technician: mapTechnicianRow(row) })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to create technician.' })
    }
  })

  router.patch('/technicians/:id', async (req, res) => {
    const id = toInt(req.params.id, 0)
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid technician id.' })

    const body = req.body || {}

    try {
      const row = await db.get(`SELECT * FROM technicians WHERE id = ?`, [id])
      if (!row) return res.status(404).json({ ok: false, error: 'Technician not found.' })

      const next = {
        name: body.name != null ? toText(body.name) : row.name,
        email: body.email != null ? String(body.email).trim() || null : row.email,
        phone: body.phone != null ? String(body.phone).trim() || null : row.phone,
        role_title:
          body.role_title != null
            ? toText(body.role_title) || null
            : body.role != null
              ? toText(body.role) || null
              : row.role_title,
        capabilities: body.capabilities != null ? toText(body.capabilities) || null : row.capabilities,
        skills_notes:
          body.skills_notes != null
            ? toText(body.skills_notes) || null
            : body.capabilities != null
              ? toText(body.capabilities) || null
              : (row.skills_notes != null ? row.skills_notes : row.capabilities),
        active: body.active != null ? (body.active === 0 || body.active === false ? 0 : 1) : row.active,
      }
      if (!next.name) return res.status(400).json({ ok: false, error: 'Technician name is required.' })

      await db.run(
        `UPDATE technicians
         SET name = ?, email = ?, phone = ?, role_title = ?, capabilities = ?, skills_notes = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [next.name, next.email, next.phone, next.role_title, next.capabilities, next.skills_notes, next.active, id],
      )

      const updated = await db.get(`SELECT * FROM technicians WHERE id = ?`, [id])
      res.json({ ok: true, technician: mapTechnicianRow(updated) })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to update technician.' })
    }
  })

  return router
}

module.exports = {
  createTechniciansRouter,
}
