'use strict'

const express = require('express')

const RANGE_CONFIG = {
  '7d': { days: 7, bucket: 'day' },
  '30d': { days: 30, bucket: 'day' },
  '90d': { days: 90, bucket: 'week' },
  '12m': { days: 365, bucket: 'month' },
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function getRangeConfig(range) {
  return RANGE_CONFIG[String(range || '30d')] || RANGE_CONFIG['30d']
}

function createReportsRouter({ db }) {
  const router = express.Router()

  router.get('/reports/summary', async (req, res) => {
    const range = String(req.query.range || '30d')
    const config = getRangeConfig(range)

    try {
      const invoicesSummary = await db.get(
        `SELECT
          COALESCE(SUM(total_inc_vat), 0) AS revenue_total,
          COUNT(*) AS invoices_count,
          SUM(CASE WHEN LOWER(status) = 'paid' THEN 1 ELSE 0 END) AS paid_invoices_count
         FROM invoices
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [config.days],
      )

      const jobsSummary = await db.get(
        `SELECT
          COUNT(*) AS jobs_total,
          SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) AS jobs_completed,
          SUM(CASE WHEN LOWER(status) IN ('in_progress','assigned','booked','active') THEN 1 ELSE 0 END) AS jobs_in_progress
         FROM jobs
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [config.days],
      )

      const quotesSummary = await db.get(
        `SELECT
          COUNT(*) AS quotes_total,
          SUM(CASE WHEN LOWER(status) = 'accepted' THEN 1 ELSE 0 END) AS quotes_accepted
         FROM quotes
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [config.days],
      )

      const revenueRows = await db.all(
        config.bucket === 'month'
          ? `SELECT
              DATE_FORMAT(created_at, '%Y-%m') AS bucket_key,
              DATE_FORMAT(created_at, '%b %Y') AS bucket_label,
              COALESCE(SUM(total_inc_vat), 0) AS revenue_total,
              COUNT(*) AS invoices_count
             FROM invoices
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY DATE_FORMAT(created_at, '%Y-%m'), DATE_FORMAT(created_at, '%b %Y')
             ORDER BY bucket_key ASC`
          : config.bucket === 'week'
            ? `SELECT
                DATE_FORMAT(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d') AS bucket_key,
                CONCAT('Week of ', DATE_FORMAT(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY), '%d %b')) AS bucket_label,
                COALESCE(SUM(total_inc_vat), 0) AS revenue_total,
                COUNT(*) AS invoices_count
               FROM invoices
               WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
               GROUP BY DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY)
               ORDER BY bucket_key ASC`
            : `SELECT
                DATE_FORMAT(created_at, '%Y-%m-%d') AS bucket_key,
                DATE_FORMAT(created_at, '%d %b') AS bucket_label,
                COALESCE(SUM(total_inc_vat), 0) AS revenue_total,
                COUNT(*) AS invoices_count
               FROM invoices
               WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
               GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d'), DATE_FORMAT(created_at, '%d %b')
               ORDER BY bucket_key ASC`,
        [config.days],
      )

      const technicianRows = await db.all(
        `SELECT
          t.id AS technician_id,
          t.name AS technician_name,
          COALESCE(COUNT(DISTINCT a.id), 0) AS jobs_assigned,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(a.status, '')) = 'completed' OR a.completed_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS jobs_completed,
          COALESCE(SUM(COALESCE(a.estimated_hours, 0)), 0) AS estimated_hours,
          COALESCE(SUM(COALESCE(a.actual_hours, 0)), 0) AS actual_hours,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(a.status, '')) IN ('assigned', 'in_progress', 'paused') THEN 1 ELSE 0 END), 0) AS active_jobs,
          COALESCE(COUNT(DISTINCT e.id), 0) AS activity_events_count,
          COALESCE(COUNT(DISTINCT tsa.id), 0) AS skills_count
         FROM technicians t
         LEFT JOIN job_technician_assignments a
           ON a.technician_id = t.id
          AND a.assigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         LEFT JOIN job_activity_events e
           ON e.technician_id = t.id
          AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         LEFT JOIN technician_skill_assignments tsa
           ON tsa.technician_id = t.id
         GROUP BY t.id, t.name
         ORDER BY t.name ASC`,
        [config.days, config.days],
      )

      const bayRows = await db.all(
        `SELECT
          b.id AS bay_id,
          b.name AS bay_name,
          b.bay_type,
          b.is_mot_bay,
          b.active,
          COALESCE(curr.active_assignments, 0) AS active_assignments,
          COALESCE(rng.assignments_in_range, 0) AS assignments_in_range,
          COALESCE(rng.completed_or_released_in_range, 0) AS completed_or_released_in_range,
          curr.current_job_registration
         FROM workshop_bays b
         LEFT JOIN (
           SELECT
             jba.bay_id,
             COUNT(*) AS active_assignments,
             SUBSTRING_INDEX(GROUP_CONCAT(v.registration ORDER BY jba.assigned_at DESC SEPARATOR ','), ',', 1) AS current_job_registration
           FROM job_bay_assignments jba
           JOIN jobs j ON j.id = jba.job_id
           JOIN vehicles v ON v.id = j.vehicle_id
           WHERE jba.released_at IS NULL
           GROUP BY jba.bay_id
         ) curr ON curr.bay_id = b.id
         LEFT JOIN (
           SELECT
             bay_id,
             SUM(CASE WHEN assigned_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN 1 ELSE 0 END) AS assignments_in_range,
             SUM(CASE WHEN released_at IS NOT NULL AND released_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN 1 ELSE 0 END) AS completed_or_released_in_range
           FROM job_bay_assignments
           GROUP BY bay_id
         ) rng ON rng.bay_id = b.id
         ORDER BY b.active DESC, b.name ASC`,
        [config.days, config.days],
      )

      const servicesRows = await db.all(
        `SELECT
          st.id AS service_id,
          COALESCE(st.name, j.title, 'UNKNOWN SERVICE') AS service_name,
          COUNT(j.id) AS jobs_count,
          SUM(CASE WHEN LOWER(COALESCE(j.status, '')) = 'completed' THEN 1 ELSE 0 END) AS completed_count,
          COALESCE(SUM(inv.total_inc_vat), 0) AS revenue_total
         FROM jobs j
         LEFT JOIN service_templates st ON st.id = j.service_template_id
         LEFT JOIN invoices inv ON inv.job_id = j.id
         WHERE j.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY st.id, COALESCE(st.name, j.title, 'UNKNOWN SERVICE')
         ORDER BY jobs_count DESC, service_name ASC
         LIMIT 20`,
        [config.days],
      )

      const customersTotals = await db.get(`SELECT COUNT(*) AS total_customers FROM customers`)
      const repeatCustomers = await db.get(
        `SELECT COUNT(*) AS repeat_customers
         FROM (
           SELECT c.id
           FROM customers c
           JOIN jobs j ON j.customer_id = c.id
           GROUP BY c.id
           HAVING COUNT(j.id) > 1
         ) x`,
      )
      const newCustomers = await db.get(
        `SELECT COUNT(*) AS new_customers_in_range
         FROM customers
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [config.days],
      )

      const partsSummary = await db.get(
        `SELECT
          COUNT(*) AS parts_orders_count,
          SUM(CASE WHEN status = 'received' THEN 1 ELSE 0 END) AS received_count,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
          SUM(CASE WHEN status IN ('return_required', 'returned', 'credit_pending') THEN 1 ELSE 0 END) AS returned_count
         FROM parts_orders
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [config.days],
      )

      const revenueTotal = toNumber(invoicesSummary?.revenue_total, 0)
      const invoicesCount = toNumber(invoicesSummary?.invoices_count, 0)
      const paidInvoicesCount = toNumber(invoicesSummary?.paid_invoices_count, 0)
      const totalCustomers = toNumber(customersTotals?.total_customers, 0)
      const repeatCustomersCount = toNumber(repeatCustomers?.repeat_customers, 0)

      res.json({
        ok: true,
        range,
        generated_at: new Date().toISOString(),
        overview: {
          revenue_total: revenueTotal,
          invoices_count: invoicesCount,
          paid_invoices_count: paidInvoicesCount,
          unpaid_invoices_count: Math.max(0, invoicesCount - paidInvoicesCount),
          jobs_total: toNumber(jobsSummary?.jobs_total, 0),
          jobs_completed: toNumber(jobsSummary?.jobs_completed, 0),
          jobs_in_progress: toNumber(jobsSummary?.jobs_in_progress, 0),
          quotes_total: toNumber(quotesSummary?.quotes_total, 0),
          quotes_accepted: toNumber(quotesSummary?.quotes_accepted, 0),
          average_invoice_value: invoicesCount > 0 ? revenueTotal / invoicesCount : 0,
        },
        revenue: (revenueRows || []).map((r) => ({
          date: r.bucket_label,
          revenue_total: toNumber(r.revenue_total, 0),
          invoices_count: toNumber(r.invoices_count, 0),
        })),
        technicians: (technicianRows || []).map((r) => ({
          technician_id: r.technician_id,
          technician_name: r.technician_name,
          jobs_assigned: toNumber(r.jobs_assigned, 0),
          jobs_completed: toNumber(r.jobs_completed, 0),
          estimated_hours: toNumber(r.estimated_hours, 0),
          actual_hours: toNumber(r.actual_hours, 0),
          active_jobs: toNumber(r.active_jobs, 0),
          activity_events_count: toNumber(r.activity_events_count, 0),
          skills_count: toNumber(r.skills_count, 0),
        })),
        bays: (bayRows || []).map((r) => ({
          bay_id: r.bay_id,
          bay_name: r.bay_name,
          bay_type: r.bay_type,
          is_mot_bay: toNumber(r.is_mot_bay, 0),
          active: toNumber(r.active, 0),
          active_assignments: toNumber(r.active_assignments, 0),
          assignments_in_range: toNumber(r.assignments_in_range, 0),
          completed_or_released_in_range: toNumber(r.completed_or_released_in_range, 0),
          current_job_registration: r.current_job_registration || null,
        })),
        services: (servicesRows || []).map((r) => ({
          service_title: r.service_name,
          jobs_count: toNumber(r.jobs_count, 0),
          completed_count: toNumber(r.completed_count, 0),
          revenue_total: toNumber(r.revenue_total, 0),
        })),
        customers: {
          total_customers: totalCustomers,
          repeat_customers: repeatCustomersCount,
          repeat_customer_rate: totalCustomers > 0 ? (repeatCustomersCount / totalCustomers) : 0,
          new_customers_in_range: toNumber(newCustomers?.new_customers_in_range, 0),
        },
        parts: {
          parts_orders_count: toNumber(partsSummary?.parts_orders_count, 0),
          received_count: toNumber(partsSummary?.received_count, 0),
          pending_count: toNumber(partsSummary?.pending_count, 0),
          returned_count: toNumber(partsSummary?.returned_count, 0),
        },
        profit_margin: {
          gross_profit_total: null,
          gross_margin_percent: null,
          status: 'not_enough_data_yet',
          note: 'Not enough cost data yet.',
        },
      })
    } catch {
      res.status(500).json({ ok: false, error: 'Failed to load reports summary.' })
    }
  })

  return router
}

module.exports = {
  createReportsRouter,
}
