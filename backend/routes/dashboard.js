'use strict'

const express = require('express')

function createDashboardRouter({ db }) {
  const router = express.Router()

  // Safe counts only (no secrets, no customer data).
  router.get('/dashboard/summary', async (req, res) => {
    try {
      const openJobsRow = await db.get(
        `SELECT COUNT(*) AS count FROM jobs WHERE LOWER(status) <> 'completed'`,
      )
      const jobsTodayRow = await db.get(
        `SELECT COUNT(*) AS count FROM jobs WHERE requested_date = DATE_FORMAT(CURDATE(), '%Y-%m-%d')`,
      )
      const jobsNeedingQuoteRow = await db.get(
        `
        SELECT COUNT(*) AS count
        FROM jobs j
        LEFT JOIN quotes q ON q.job_id = j.id
        WHERE q.id IS NULL
          AND LOWER(j.status) <> 'completed'
      `,
      )

      const quotesByStatus = await db.all(
        `
        SELECT status, COUNT(*) AS count
        FROM quotes
        GROUP BY status
      `,
      )

      const motInProgressRow = await db.get(
        `
        SELECT COUNT(*) AS count
        FROM jobs j
        JOIN service_templates st ON st.id = j.service_template_id
        WHERE st.is_mot = 1
          AND LOWER(j.status) <> 'completed'
      `,
      )
      const motBookedTodayRow = await db.get(
        `SELECT COUNT(*) AS count FROM mot_events WHERE DATE(mot_time) = CURDATE()`,
      )
      const motFailedRow = await db.get(
        `SELECT COUNT(*) AS count FROM mot_events WHERE LOWER(COALESCE(result, status)) = 'failed'`,
      )
      const motPassedRow = await db.get(
        `SELECT COUNT(*) AS count FROM mot_events WHERE LOWER(COALESCE(result, status)) = 'passed'`,
      )

      const motActiveChecksRow = await db.get(
        `SELECT COUNT(*) AS count FROM mot_result_checks WHERE status NOT IN ('complete', 'failed')`,
      ).catch(() => ({ count: 0 }))
      const motCompletedChecksRow = await db.get(
        `SELECT COUNT(*) AS count FROM mot_result_checks WHERE status = 'complete'`,
      ).catch(() => ({ count: 0 }))
      const motFailedChecksRow = await db.get(
        `SELECT COUNT(*) AS count FROM mot_result_checks WHERE status = 'failed'`,
      ).catch(() => ({ count: 0 }))

      const partsToOrderRow = await db.get(
        `SELECT COUNT(*) AS count FROM parts_orders WHERE status = 'pending'`,
      )
      const partsOrderedRow = await db.get(
        `SELECT COUNT(*) AS count FROM parts_orders WHERE status = 'ordered'`,
      )
      const partsExpectedTodayRow = await db.get(
        `
        SELECT COUNT(*) AS count
        FROM parts_orders
        WHERE status = 'ordered'
          AND DATE(COALESCE(expected_at, eta_datetime)) = CURDATE()
      `,
      )
      const partsOverdueRow = await db.get(
        `
        SELECT COUNT(*) AS count
        FROM parts_orders
        WHERE status IN ('pending','ordered','return_required','returned','credit_pending')
          AND COALESCE(expected_at, eta_datetime) IS NOT NULL
          AND DATE(COALESCE(expected_at, eta_datetime)) < CURDATE()
      `,
      )
      const goodsReceivedTodayRow = await db.get(
        `SELECT COUNT(*) AS count FROM goods_received WHERE DATE(received_at) = CURDATE()`,
      )
      const returnsPendingRow = await db.get(
        `
        SELECT COUNT(*) AS count
        FROM parts_orders
        WHERE status IN ('return_required','returned','credit_pending')
      `,
      )

      const summary = {
        total_open_jobs: Number(openJobsRow?.count || 0),
        jobs_booked_today: Number(jobsTodayRow?.count || 0),
        jobs_needing_quote: Number(jobsNeedingQuoteRow?.count || 0),
        quotes_by_status: Object.fromEntries(
          (quotesByStatus || []).map((r) => [String(r.status || 'unknown'), Number(r.count || 0)]),
        ),
        mot_jobs_in_progress: Number(motInProgressRow?.count || 0),
        mot_booked_today: Number(motBookedTodayRow?.count || 0),
        mot_failed: Number(motFailedRow?.count || 0),
        mot_passed: Number(motPassedRow?.count || 0),
        mot_active_checks: Number(motActiveChecksRow?.count || 0),
        mot_completed_checks: Number(motCompletedChecksRow?.count || 0),
        mot_failed_checks: Number(motFailedChecksRow?.count || 0),
        parts_waiting: 0,
        parts_to_order: Number(partsToOrderRow?.count || 0),
        parts_ordered: Number(partsOrderedRow?.count || 0),
        parts_expected_today: Number(partsExpectedTodayRow?.count || 0),
        parts_overdue: Number(partsOverdueRow?.count || 0),
        goods_received_today: Number(goodsReceivedTodayRow?.count || 0),
        returns_pending: Number(returnsPendingRow?.count || 0),
        time: new Date().toISOString(),
      }

      res.json({ ok: true, summary })
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to load dashboard summary.' })
    }
  })

  return router
}

module.exports = {
  createDashboardRouter,
}
