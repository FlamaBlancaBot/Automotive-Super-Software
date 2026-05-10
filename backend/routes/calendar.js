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

  return router
}

module.exports = {
  createCalendarRouter,
}
