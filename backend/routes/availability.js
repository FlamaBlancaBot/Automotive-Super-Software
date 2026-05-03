'use strict'

const express = require('express')
const { combineLocalDateAndTime, addMinutesToDateTime } = require('../db/utils')

function toInt(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function overlaps(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false
  const a0 = new Date(startA.replace(' ', 'T') + 'Z').getTime()
  const a1 = new Date(endA.replace(' ', 'T') + 'Z').getTime()
  const b0 = new Date(startB.replace(' ', 'T') + 'Z').getTime()
  const b1 = new Date(endB.replace(' ', 'T') + 'Z').getTime()
  return a0 < b1 && b0 < a1
}

function createAvailabilityRouter({ db }) {
  const router = express.Router()

  router.get('/suggest', async (req, res) => {
    const requestedDate = String(req.query.requested_date || '').trim()
    const arrivalTime = String(req.query.arrival_time || '').trim()
    const priority = String(req.query.priority || 'normal').trim()
    const durationMinutes = toInt(req.query.duration_minutes, 60)

    const requestedStart = combineLocalDateAndTime(requestedDate, arrivalTime)
    const requestedEnd = requestedStart
      ? addMinutesToDateTime(requestedStart, durationMinutes)
      : null

    if (!requestedStart || !requestedEnd) {
      return res.status(400).json({
        ok: false,
        error: 'Please provide requested_date (YYYY-MM-DD), arrival_time (HH:MM), and duration_minutes.',
      })
    }

    const dayJobs = await db.all(
      `
      SELECT id, title, booked_start, booked_end, priority, status
      FROM jobs
      WHERE requested_date = ?
        AND booked_start IS NOT NULL
        AND booked_end IS NOT NULL
      ORDER BY booked_start ASC
    `,
      [requestedDate],
    )

    const blocking = dayJobs.filter((j) =>
      overlaps(j.booked_start, j.booked_end, requestedStart, requestedEnd),
    )

    if (blocking.length === 0) {
      return res.json({
        ok: true,
        busy: false,
        requested: {
          requested_date: requestedDate,
          arrival_time: arrivalTime,
          duration_minutes: durationMinutes,
          priority,
        },
        suggestion: { requested_date: requestedDate, arrival_time: arrivalTime },
        message: 'Requested slot looks available (basic check).',
        blocking_jobs: [],
        note: 'Availability logic will be improved later (capacity, technicians, urgent fit-ins).',
      })
    }

    // Simple suggestion: move to the next half-hour after the latest overlapping job ends.
    const latestEnd = blocking.reduce((acc, j) => (j.booked_end > acc ? j.booked_end : acc), blocking[0].booked_end)
    const suggestedStart = latestEnd.slice(0, 16).replace('T', ' ').replace('Z', '') // "YYYY-MM-DD HH:MM"
    const suggestedTime = suggestedStart.split(' ')[1] || arrivalTime

    res.json({
      ok: true,
      busy: true,
      requested: {
        requested_date: requestedDate,
        arrival_time: arrivalTime,
        duration_minutes: durationMinutes,
        priority,
      },
      suggestion: { requested_date: requestedDate, arrival_time: suggestedTime },
      message: 'Requested slot looks busy based on existing booked jobs (seed data).',
      blocking_jobs: blocking,
      note: 'Availability logic will be improved later (capacity, technicians, urgent fit-ins).',
    })
  })

  return router
}

module.exports = {
  createAvailabilityRouter,
}
