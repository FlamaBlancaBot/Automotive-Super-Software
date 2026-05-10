'use strict'

const express = require('express')

function parseDate(value) {
  const v = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
}

function toDateOnly(dt) {
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function colourFallback(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('completed')) return 'green'
  if (s.includes('cancel')) return 'grey'
  if (s.includes('progress')) return 'blue'
  if (s.includes('parts')) return 'orange'
  if (s.includes('mot_failed') || s.includes('failed')) return 'red'
  return 'grey'
}

function dateRange(start, end) {
  const out = []
  const cur = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cur <= last) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    out.push(`${y}-${m}-${d}`)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function isJobActiveStatus(status) {
  const s = String(status || '').toLowerCase()
  return !(s === 'completed' || s === 'cancelled' || s === 'draft')
}

function toMs(value) {
  if (!value) return null
  const t = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isNaN(t) ? null : t
}

async function safeAll(db, sql, params = [], fallback = []) {
  try {
    return await db.all(sql, params)
  } catch (err) {
    const code = String(err && err.code ? err.code : '')
    if (code === 'ER_NO_SUCH_TABLE' || code === 'ER_BAD_FIELD_ERROR') return fallback
    throw err
  }
}

function createCalendarRouter({ db }) {
  const router = express.Router()

  router.get('/calendar/jobs', async (req, res) => {
    const start = parseDate(req.query.start)
    const end = parseDate(req.query.end)
    const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true'

    if (!start || !end) {
      return res.status(400).json({ ok: false, error: 'start and end are required as YYYY-MM-DD.' })
    }

    try {
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
          j.estimated_duration_minutes,
          j.updated_at,
          v.registration,
          v.make AS vehicle_make,
          v.model AS vehicle_model,
          c.first_name AS customer_first_name,
          c.surname AS customer_surname,
          q.latest_quote_status,
          q.latest_quote_number,
          p.parts_status,
          b.bay_name,
          b.bay_type,
          b.is_mot_bay,
          js.label AS status_label,
          js.colour AS status_colour,
          js.appears_on_calendar,
          js.calendar_active
        FROM jobs j
        JOIN vehicles v ON v.id = j.vehicle_id
        JOIN customers c ON c.id = j.customer_id
        LEFT JOIN (
          SELECT
            job_id,
            SUBSTRING_INDEX(GROUP_CONCAT(status ORDER BY updated_at DESC SEPARATOR ','), ',', 1) AS latest_quote_status,
            SUBSTRING_INDEX(GROUP_CONCAT(quote_number ORDER BY updated_at DESC SEPARATOR ','), ',', 1) AS latest_quote_number
          FROM quotes
          WHERE job_id IS NOT NULL
          GROUP BY job_id
        ) q ON q.job_id = j.id
        LEFT JOIN (
          SELECT
            job_id,
            CASE
              WHEN SUM(CASE WHEN status IN ('return_required','returned','credit_pending') THEN 1 ELSE 0 END) > 0 THEN 'issue'
              WHEN SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) > 0 THEN 'to_order'
              WHEN SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) > 0 THEN 'ordered'
              WHEN SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) > 0 THEN 'received'
              ELSE 'none'
            END AS parts_status
          FROM parts_orders
          WHERE job_id IS NOT NULL
          GROUP BY job_id
        ) p ON p.job_id = j.id
        LEFT JOIN (
          SELECT
            x.job_id,
            SUBSTRING_INDEX(GROUP_CONCAT(wb.name ORDER BY x.assigned_at DESC SEPARATOR ','), ',', 1) AS bay_name,
            SUBSTRING_INDEX(GROUP_CONCAT(wb.bay_type ORDER BY x.assigned_at DESC SEPARATOR ','), ',', 1) AS bay_type,
            CAST(SUBSTRING_INDEX(GROUP_CONCAT(wb.is_mot_bay ORDER BY x.assigned_at DESC SEPARATOR ','), ',', 1) AS UNSIGNED) AS is_mot_bay
          FROM job_bay_assignments x
          JOIN workshop_bays wb ON wb.id = x.bay_id
          WHERE x.released_at IS NULL
          GROUP BY x.job_id
        ) b ON b.job_id = j.id
        LEFT JOIN job_statuses js ON js.code = j.status
        WHERE (
          (j.booked_start IS NOT NULL AND DATE(j.booked_start) <= ? AND DATE(COALESCE(j.booked_end, j.booked_start)) >= ?)
          OR (j.booked_start IS NULL AND j.requested_date BETWEEN ? AND ?)
        )
        ORDER BY COALESCE(j.booked_start, CONCAT(j.requested_date, ' 00:00:00')) ASC, j.id ASC
      `,
        [end, start, start, end],
      )

      const jobs = (rows || [])
        .map((r) => {
          const appears = r.appears_on_calendar == null ? 1 : Number(r.appears_on_calendar)
          const fallbackActive = (() => {
            const s = String(r.status || '').toLowerCase()
            if (s === 'completed' || s === 'cancelled' || s === 'draft') return 0
            return 1
          })()
          const active = r.calendar_active == null ? fallbackActive : Number(r.calendar_active)
          const isBooked = Boolean(r.booked_start)
          const startAt = r.booked_start || `${r.requested_date || start} 09:00:00`
          const fallbackEnd = (() => {
            const st = new Date(String(startAt).replace(' ', 'T'))
            if (Number.isNaN(st.getTime())) return startAt
            st.setMinutes(st.getMinutes() + Number(r.estimated_duration_minutes || 60))
            const y = st.getFullYear()
            const m = String(st.getMonth() + 1).padStart(2, '0')
            const d = String(st.getDate()).padStart(2, '0')
            const hh = String(st.getHours()).padStart(2, '0')
            const mm = String(st.getMinutes()).padStart(2, '0')
            const ss = String(st.getSeconds()).padStart(2, '0')
            return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
          })()

          return {
            id: r.id,
            status: r.status,
            status_label: r.status_label || r.status,
            status_colour: r.status_colour || colourFallback(r.status),
            calendar_active: active,
            appears_on_calendar: appears,
            priority: r.priority,
            title: r.title,
            booked_start: startAt,
            booked_end: r.booked_end || fallbackEnd,
            estimated_duration_minutes: Number(r.estimated_duration_minutes || 0),
            registration: r.registration,
            vehicle_make: r.vehicle_make,
            vehicle_model: r.vehicle_model,
            customer_name: `${r.customer_first_name || ''} ${r.customer_surname || ''}`.trim(),
            quote_status: r.latest_quote_status || null,
            quote_number: r.latest_quote_number || null,
            parts_status: r.parts_status || 'none',
            bay_name: r.bay_name || null,
            bay_type: r.bay_type || null,
            is_mot_bay: Number(r.is_mot_bay || 0),
            is_booked: isBooked,
            date_key: toDateOnly(startAt),
            faded: active ? false : true,
          }
        })
        .filter((j) => {
          if (!j.appears_on_calendar) return false
          if (!includeInactive && (!j.calendar_active || !j.is_booked)) return false
          return true
        })

      res.json({ ok: true, start, end, includeInactive, jobs })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load calendar jobs.' })
    }
  })

  router.get('/calendar/capacity', async (req, res) => {
    const start = parseDate(req.query.start)
    const end = parseDate(req.query.end)

    if (!start || !end) {
      return res.status(400).json({ ok: false, error: 'start and end are required as YYYY-MM-DD.' })
    }

    try {
      const dayKeys = dateRange(start, end)
      const dayMap = new Map(
        dayKeys.map((date) => [
          date,
          {
            date,
            jobs_count: 0,
            active_jobs_count: 0,
            completed_jobs_count: 0,
            estimated_minutes: 0,
            available_bays: 0,
            active_bay_assignments: 0,
            mot_jobs_count: 0,
            mot_bays_available: 0,
            assigned_technicians_count: 0,
            active_technicians_count: 0,
            unassigned_jobs_count: 0,
            jobs_without_bay_count: 0,
            jobs_without_technician_count: 0,
            warnings: [],
          },
        ]),
      )

      const jobs = await safeAll(
        db,
        `
        SELECT
          j.id,
          j.status,
          j.requested_date,
          j.booked_start,
          j.booked_end,
          j.estimated_duration_minutes,
          st.is_mot
        FROM jobs j
        LEFT JOIN service_templates st ON st.id = j.service_template_id
        WHERE (
          (j.booked_start IS NOT NULL AND DATE(j.booked_start) <= ? AND DATE(COALESCE(j.booked_end, j.booked_start)) >= ?)
          OR (j.booked_start IS NULL AND j.requested_date BETWEEN ? AND ?)
        )
      `,
        [end, start, start, end],
        [],
      )

      const activeBaysRow = await safeAll(
        db,
        `SELECT COUNT(*) AS count_all, SUM(CASE WHEN is_mot_bay = 1 THEN 1 ELSE 0 END) AS count_mot FROM workshop_bays WHERE active = 1`,
        [],
        [{ count_all: 0, count_mot: 0 }],
      )
      const activeBaysCount = Number((activeBaysRow[0] && activeBaysRow[0].count_all) || 0)
      const motBaysCount = Number((activeBaysRow[0] && activeBaysRow[0].count_mot) || 0)

      const activeTechRow = await safeAll(
        db,
        `SELECT COUNT(*) AS count_all FROM technicians WHERE active = 1`,
        [],
        [{ count_all: 0 }],
      )
      const activeTechCount = Number((activeTechRow[0] && activeTechRow[0].count_all) || 0)

      const bayAssignments = await safeAll(
        db,
        `
        SELECT
          jba.job_id,
          jba.assigned_at,
          jba.released_at
        FROM job_bay_assignments jba
      `,
        [],
        [],
      )

      const techAssignments = await safeAll(
        db,
        `
        SELECT
          jta.job_id,
          jta.technician_id,
          jta.status
        FROM job_technician_assignments jta
      `,
        [],
        [],
      )

      const bayByJob = new Map()
      for (const row of bayAssignments) {
        const jobId = Number(row.job_id)
        if (!bayByJob.has(jobId)) bayByJob.set(jobId, [])
        bayByJob.get(jobId).push(row)
      }
      const techByJob = new Map()
      for (const row of techAssignments) {
        const jobId = Number(row.job_id)
        if (!techByJob.has(jobId)) techByJob.set(jobId, [])
        techByJob.get(jobId).push(row)
      }

      function assignmentOverlapsDay(startAt, endAt, dayKey) {
        const dayStart = toMs(`${dayKey} 00:00:00`)
        const dayEnd = toMs(`${dayKey} 23:59:59`)
        const s = toMs(startAt)
        const e = toMs(endAt || `${dayKey} 23:59:59`)
        if (dayStart == null || dayEnd == null || s == null || e == null) return false
        return s <= dayEnd && e >= dayStart
      }

      for (const j of jobs || []) {
        const startAt = j.booked_start || `${j.requested_date || start} 09:00:00`
        const parsedStart = new Date(String(startAt).replace(' ', 'T'))
        const fallbackEnd = (() => {
          if (j.booked_end) return j.booked_end
          if (Number.isNaN(parsedStart.getTime())) return startAt
          const clone = new Date(parsedStart)
          clone.setMinutes(clone.getMinutes() + Number(j.estimated_duration_minutes || 60))
          const y = clone.getFullYear()
          const m = String(clone.getMonth() + 1).padStart(2, '0')
          const d = String(clone.getDate()).padStart(2, '0')
          const hh = String(clone.getHours()).padStart(2, '0')
          const mm = String(clone.getMinutes()).padStart(2, '0')
          const ss = String(clone.getSeconds()).padStart(2, '0')
          return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
        })()

        const spanDays = (() => {
          const s = toDateOnly(startAt)
          const e = toDateOnly(fallbackEnd)
          if (!s || !e) return []
          return dateRange(s < start ? start : s, e > end ? end : e)
        })()

        const jobBayRows = bayByJob.get(Number(j.id)) || []
        const jobTechRows = techByJob.get(Number(j.id)) || []

        for (const dayKey of spanDays) {
          const day = dayMap.get(dayKey)
          if (!day) continue
          day.jobs_count += 1
          day.estimated_minutes += Number(j.estimated_duration_minutes || 0)
          if (isJobActiveStatus(j.status)) day.active_jobs_count += 1
          if (String(j.status || '').toLowerCase() === 'completed') day.completed_jobs_count += 1
          if (Number(j.is_mot || 0) === 1 || String(j.status || '').toLowerCase().includes('mot')) day.mot_jobs_count += 1

          const hasBay = jobBayRows.some((r) =>
            assignmentOverlapsDay(r.assigned_at || startAt, r.released_at || fallbackEnd, dayKey),
          )
          const dayTechRows = jobTechRows.filter((r) => String(r.status || '').toLowerCase() !== 'cancelled')
          const hasTech = dayTechRows.length > 0

          if (!hasBay) day.jobs_without_bay_count += 1
          if (!hasTech) day.jobs_without_technician_count += 1
          if (!hasBay || !hasTech) day.unassigned_jobs_count += 1
        }
      }

      for (const dayKey of dayKeys) {
        const day = dayMap.get(dayKey)
        day.available_bays = activeBaysCount
        day.mot_bays_available = motBaysCount
        day.active_technicians_count = activeTechCount

        const dayStart = `${dayKey} 00:00:00`
        const dayEnd = `${dayKey} 23:59:59`

        let bayAssignedCount = 0
        for (const row of bayAssignments) {
          const s = row.assigned_at || dayStart
          const e = row.released_at || dayEnd
          if (assignmentOverlapsDay(s, e, dayKey)) bayAssignedCount += 1
        }
        day.active_bay_assignments = bayAssignedCount

        const assignedTechs = new Set()
        for (const row of techAssignments) {
          if (String(row.status || '').toLowerCase() === 'cancelled') continue
          assignedTechs.add(Number(row.technician_id))
        }
        day.assigned_technicians_count = assignedTechs.size

        const warnings = []
        if (day.jobs_count > 0 && day.jobs_without_bay_count > 0) warnings.push(`${day.jobs_without_bay_count} jobs have no bay assigned`)
        if (day.jobs_count > 0 && day.jobs_without_technician_count > 0) warnings.push(`${day.jobs_without_technician_count} jobs have no technician assigned`)
        if (day.available_bays > 0 && day.active_bay_assignments > day.available_bays) warnings.push('Bay usage exceeds active bays')
        if (day.mot_jobs_count > 0 && day.mot_bays_available === 0) warnings.push('MOT jobs scheduled but no active MOT bay available')
        if (day.active_technicians_count > 0 && day.assigned_technicians_count > day.active_technicians_count) warnings.push('Technician assignments exceed active technicians')
        if (day.estimated_minutes >= 8 * 60 * Math.max(1, day.available_bays || 1)) warnings.push('Estimated workload is high for available bays')
        day.warnings = warnings
      }

      const days = dayKeys.map((d) => dayMap.get(d))
      const summary = {
        range_start: start,
        range_end: end,
        total_jobs: days.reduce((n, d) => n + Number(d.jobs_count || 0), 0),
        total_estimated_minutes: days.reduce((n, d) => n + Number(d.estimated_minutes || 0), 0),
        overbooked_days: days.filter((d) => d.warnings.some((w) => w.includes('exceeds') || w.includes('high'))).length,
        total_unassigned_jobs: days.reduce((n, d) => n + Number(d.unassigned_jobs_count || 0), 0),
        total_jobs_without_bay: days.reduce((n, d) => n + Number(d.jobs_without_bay_count || 0), 0),
        total_jobs_without_technician: days.reduce((n, d) => n + Number(d.jobs_without_technician_count || 0), 0),
        total_mot_jobs: days.reduce((n, d) => n + Number(d.mot_jobs_count || 0), 0),
        warnings: [],
      }
      if (summary.total_jobs === 0) summary.warnings.push('No jobs scheduled in this range.')
      if (summary.total_jobs_without_bay > 0) summary.warnings.push(`${summary.total_jobs_without_bay} jobs have no bay assignment in this range.`)
      if (summary.total_jobs_without_technician > 0) summary.warnings.push(`${summary.total_jobs_without_technician} jobs have no technician assignment in this range.`)

      res.json({ ok: true, days, summary })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load calendar capacity.' })
    }
  })

  return router
}

module.exports = {
  createCalendarRouter,
}
