'use strict'

const express = require('express')
const { combineLocalDateAndTime, addMinutesToDateTime } = require('../db/utils')

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function truthy(value) {
  const v = String(value || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'y'
}

function toDateTimeMs(value) {
  if (!value) return null
  const ms = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isNaN(ms) ? null : ms
}

function overlaps(startA, endA, startB, endB) {
  const a0 = toDateTimeMs(startA)
  const a1 = toDateTimeMs(endA)
  const b0 = toDateTimeMs(startB)
  const b1 = toDateTimeMs(endB)
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false
  return a0 < b1 && b0 < a1
}

function skillHintsFromService(serviceTitle) {
  const t = String(serviceTitle || '').trim().toLowerCase()
  const hints = new Set()
  if (!t) return []
  if (t.includes('mot')) {
    hints.add('MOT preparation')
    hints.add('MOT testing')
  }
  if (t.includes('brake')) hints.add('Brakes')
  if (t.includes('suspension')) hints.add('Suspension')
  if (t.includes('diagnostic') || t.includes('diagnosis')) hints.add('Diagnostics')
  if (t.includes('electrical') || t.includes('electric')) hints.add('Electrical')
  if (t.includes('engine')) hints.add('Engine rebuild')
  if (t.includes('clutch') || t.includes('gearbox')) hints.add('Gearbox/clutch')
  if (t.includes('air con') || t.includes('air conditioning')) hints.add('Air conditioning')
  if (t.includes('weld')) hints.add('Welding')
  if (t.includes('service')) hints.add('General servicing')
  return Array.from(hints)
}

async function safeAll(db, sql, params, fallback = []) {
  try {
    return await db.all(sql, params)
  } catch (err) {
    const code = String(err && err.code ? err.code : '')
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return fallback
    throw err
  }
}

async function safeGet(db, sql, params, fallback = null) {
  try {
    return await db.get(sql, params)
  } catch (err) {
    const code = String(err && err.code ? err.code : '')
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return fallback
    throw err
  }
}

function createAvailabilityRouter({ db }) {
  const router = express.Router()

  router.get('/suggest', async (req, res) => {
    const date = String(req.query.date || req.query.requested_date || '').trim()
    const time = String(req.query.time || req.query.arrival_time || '').trim()
    const durationMinutes = Math.max(15, toInt(req.query.duration_minutes, 60))
    const jobId = toInt(req.query.job_id, 0)
    const explicitRequiredSkill = String(req.query.required_skill || '').trim()
    const serviceTitleQuery = String(req.query.service_title || '').trim()
    const serviceId = toInt(req.query.service_id, 0)
    const requiresMotBayQuery = req.query.requires_mot_bay

    const requestedStart = combineLocalDateAndTime(date, time)
    const requestedEnd = requestedStart ? addMinutesToDateTime(requestedStart, durationMinutes) : null

    if (!requestedStart || !requestedEnd) {
      return res.status(400).json({
        ok: false,
        error: 'Please provide date (or requested_date), time (or arrival_time), and duration_minutes.',
      })
    }

    try {
      let serviceTitle = serviceTitleQuery
      let serviceIsMot = false

      if (!serviceTitle && serviceId) {
        const serviceRow = await safeGet(
          db,
          `SELECT name, is_mot FROM service_templates WHERE id = ?`,
          [serviceId],
          null,
        )
        if (serviceRow) {
          serviceTitle = String(serviceRow.name || '')
          serviceIsMot = Number(serviceRow.is_mot || 0) === 1
        }
      }

      const requiresMotBay =
        requiresMotBayQuery != null
          ? truthy(requiresMotBayQuery)
          : serviceIsMot || String(serviceTitle || '').toLowerCase().includes('mot')

      const inferredSkills = skillHintsFromService(serviceTitle)
      const requiredSkills = explicitRequiredSkill
        ? [explicitRequiredSkill, ...inferredSkills].filter(Boolean)
        : inferredSkills
      const requiredSkillsLower = requiredSkills.map((s) => s.toLowerCase())

      const conflictJobs = await safeAll(
        db,
        `
        SELECT
          j.id,
          j.booked_start,
          j.booked_end,
          v.registration
        FROM jobs j
        LEFT JOIN vehicles v ON v.id = j.vehicle_id
        WHERE j.booked_start IS NOT NULL
          AND j.booked_end IS NOT NULL
          AND (? = 0 OR j.id <> ?)
      `,
        [jobId || 0, jobId || 0],
        [],
      )

      const overlappingJobs = (conflictJobs || []).filter((j) =>
        overlaps(j.booked_start, j.booked_end, requestedStart, requestedEnd),
      )

      const overlappingJobIds = new Set(overlappingJobs.map((j) => Number(j.id)))
      const jobById = new Map(overlappingJobs.map((j) => [Number(j.id), j]))

      const bays = await safeAll(
        db,
        `
        SELECT id, name, bay_type, is_mot_bay, active
        FROM workshop_bays
        ORDER BY active DESC, is_mot_bay DESC, name ASC
      `,
        [],
        [],
      )

      const bayConflicts = await safeAll(
        db,
        `
        SELECT
          jba.id,
          jba.job_id,
          jba.bay_id
        FROM job_bay_assignments jba
        WHERE jba.released_at IS NULL
      `,
        [],
        [],
      )

      const bayConflictByBayId = new Map()
      const conflicts = []
      for (const row of bayConflicts || []) {
        const relatedJob = jobById.get(Number(row.job_id))
        if (!relatedJob) continue
        if (!bayConflictByBayId.has(Number(row.bay_id))) bayConflictByBayId.set(Number(row.bay_id), [])
        bayConflictByBayId.get(Number(row.bay_id)).push(relatedJob)
      }

      const baySuggestions = (bays || []).map((b) => {
        const bayId = Number(b.id)
        const bayConflictingJobs = bayConflictByBayId.get(bayId) || []
        const active = Number(b.active || 0) === 1
        const motMatch = !requiresMotBay || Number(b.is_mot_bay || 0) === 1
        const available = active && motMatch && bayConflictingJobs.length === 0
        let reason = 'Available for requested time'
        if (!active) reason = 'Bay is inactive'
        else if (!motMatch) reason = 'Not an MOT bay'
        else if (bayConflictingJobs.length > 0) reason = 'Bay has a conflict in this time window'

        for (const job of bayConflictingJobs) {
          conflicts.push({
            type: 'bay',
            name: b.name,
            job_id: job.id,
            registration: job.registration || null,
            start: job.booked_start,
            end: job.booked_end,
          })
        }

        return {
          bay_id: bayId,
          bay_name: b.name,
          bay_type: b.bay_type || 'general',
          is_mot_bay: Number(b.is_mot_bay || 0) === 1,
          available,
          reason,
          active,
          conflicts_count: bayConflictingJobs.length,
        }
      })

      baySuggestions.sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1
        if (a.is_mot_bay !== b.is_mot_bay) return a.is_mot_bay ? -1 : 1
        return String(a.bay_name).localeCompare(String(b.bay_name))
      })

      const technicians = await safeAll(
        db,
        `
        SELECT id, name, role_title, active
        FROM technicians
        ORDER BY active DESC, name ASC
      `,
        [],
        [],
      )

      const techSkills = await safeAll(
        db,
        `
        SELECT
          tsa.technician_id,
          ts.name AS skill_name
        FROM technician_skill_assignments tsa
        JOIN technician_skills ts ON ts.id = tsa.skill_id
        WHERE ts.active = 1
      `,
        [],
        [],
      )

      const techActiveJobs = await safeAll(
        db,
        `
        SELECT
          technician_id,
          COUNT(*) AS active_jobs
        FROM job_technician_assignments
        WHERE status IS NULL OR status NOT IN ('completed', 'cancelled')
        GROUP BY technician_id
      `,
        [],
        [],
      )

      const techAssignments = await safeAll(
        db,
        `
        SELECT
          a.technician_id,
          a.job_id,
          a.status,
          a.estimated_hours,
          a.actual_hours
        FROM job_technician_assignments a
        WHERE a.status IS NULL OR a.status NOT IN ('completed', 'cancelled')
      `,
        [],
        [],
      )

      const techActivityCounts = await safeAll(
        db,
        `
        SELECT technician_id, COUNT(*) AS events_count
        FROM job_activity_events
        WHERE technician_id IS NOT NULL
        GROUP BY technician_id
      `,
        [],
        [],
      )

      const skillsByTech = new Map()
      for (const row of techSkills || []) {
        const techId = Number(row.technician_id)
        if (!skillsByTech.has(techId)) skillsByTech.set(techId, [])
        skillsByTech.get(techId).push(String(row.skill_name || ''))
      }

      const activeJobsByTech = new Map((techActiveJobs || []).map((r) => [Number(r.technician_id), Number(r.active_jobs || 0)]))
      const activityCountByTech = new Map((techActivityCounts || []).map((r) => [Number(r.technician_id), Number(r.events_count || 0)]))

      const conflictByTech = new Map()
      for (const row of techAssignments || []) {
        const relatedJob = jobById.get(Number(row.job_id))
        if (!relatedJob) continue
        const techId = Number(row.technician_id)
        if (!conflictByTech.has(techId)) conflictByTech.set(techId, [])
        conflictByTech.get(techId).push(relatedJob)
      }

      const technicianSuggestions = (technicians || []).map((t) => {
        const techId = Number(t.id)
        const active = Number(t.active || 0) === 1
        const techSkillNames = skillsByTech.get(techId) || []
        const matchingSkills = requiredSkillsLower.length
          ? techSkillNames.filter((skill) => requiredSkillsLower.includes(String(skill || '').toLowerCase()))
          : []
        const skillScore = matchingSkills.length
        const techConflicts = conflictByTech.get(techId) || []
        const available = active && techConflicts.length === 0
        let reason = 'Available'
        if (!active) reason = 'Technician is inactive'
        else if (available && skillScore > 0) reason = 'Available and has matching skills'
        else if (available && requiredSkillsLower.length > 0) reason = 'Available but no exact skill match'
        else if (!available) reason = 'Already assigned in requested time window'

        for (const job of techConflicts) {
          conflicts.push({
            type: 'technician',
            name: t.name,
            job_id: job.id,
            registration: job.registration || null,
            start: job.booked_start,
            end: job.booked_end,
          })
        }

        return {
          technician_id: techId,
          name: t.name,
          role_title: t.role_title || null,
          available,
          matching_skills: matchingSkills,
          skills_score: skillScore,
          active_jobs: Number(activeJobsByTech.get(techId) || 0),
          activity_events_count: Number(activityCountByTech.get(techId) || 0),
          skills_count: techSkillNames.length,
          reason,
          active,
        }
      })

      technicianSuggestions.sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1
        if (a.skills_score !== b.skills_score) return b.skills_score - a.skills_score
        if (a.active_jobs !== b.active_jobs) return a.active_jobs - b.active_jobs
        return String(a.name).localeCompare(String(b.name))
      })

      const warnings = []
      const activeBays = baySuggestions.filter((b) => b.active)
      const availableBays = baySuggestions.filter((b) => b.available)
      const activeTechs = technicianSuggestions.filter((t) => t.active)
      const availableTechs = technicianSuggestions.filter((t) => t.available)
      const matchingTechs = technicianSuggestions.filter((t) => t.available && t.skills_score > 0)

      if (!activeBays.length) warnings.push('No active bays configured in Settings.')
      if (requiresMotBay && !activeBays.some((b) => b.is_mot_bay)) warnings.push('No active MOT bay is configured.')
      if (!activeTechs.length) warnings.push('No active technicians configured in Settings.')
      if (requiredSkillsLower.length && matchingTechs.length === 0) warnings.push('No available technician has an exact matching skill for this service.')

      const response = {
        ok: true,
        requested: {
          start: requestedStart,
          end: requestedEnd,
          duration_minutes: durationMinutes,
          date,
          time,
          job_id: jobId || null,
          service_title: serviceTitle || null,
          requires_mot_bay: requiresMotBay,
          required_skills: requiredSkills,
        },
        summary: {
          available_bays: availableBays.length,
          busy_bays: Math.max(0, activeBays.length - availableBays.length),
          available_technicians: availableTechs.length,
          matching_technicians: matchingTechs.length,
          warnings,
        },
        bay_suggestions: baySuggestions,
        technician_suggestions: technicianSuggestions,
        conflicts,
      }

      // Backward compatibility for previous onboarding response shape.
      response.busy = response.conflicts.length > 0
      response.message = response.busy
        ? 'Requested slot has conflicts. Review bay and technician suggestions.'
        : 'Requested slot looks available for current bays and technicians.'
      response.suggestion = { requested_date: date, arrival_time: time }
      response.blocking_jobs = overlappingJobs

      return res.json(response)
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to calculate availability suggestions.' })
    }
  })

  return router
}

module.exports = {
  createAvailabilityRouter,
}
