'use strict'

// Main entrypoint for the backend API.
//
// Keep this file simple: load environment variables, create the Express app,
// register routes, then start listening.

const express = require('express')
const dotenv = require('dotenv')
const path = require('path')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const rootPackage = require('../package.json')

dotenv.config({ quiet: true })

async function main() {
  const app = express()

  // If you add a frontend API call later, we may add CORS settings here.
  app.use(express.json())
  app.use(cookieParser())

  // Minimal CORS for local development (Vite dev server).
  // Keep this simple for now. Lock it down properly once auth is added.
  app.use((req, res, next) => {
    const origin = req.headers.origin
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'

    if (origin && (origin === allowedOrigin || allowedOrigin === '*')) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    )
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Setup-Token')

    if (req.method === 'OPTIONS') return res.status(204).end()
    next()
  })

  const { createDb, getDbClient } = require('./db')
  const { createAuthMiddleware, requireRole, getSessionUser } = require('./lib/auth')
  const { createCustomersRouter } = require('./routes/customers')
  const { createVehiclesRouter } = require('./routes/vehicles')
  const { createServicesRouter } = require('./routes/services')
  const { createAvailabilityRouter } = require('./routes/availability')
  const { createIntakeRouter } = require('./routes/intake')
  const { createQuotesRouter } = require('./routes/quotes')
  const { createSuppliersRouter } = require('./routes/suppliers')
  const { createSetupRouter } = require('./routes/setup')
  const {
    createPredefinedQuoteItemsRouter,
  } = require('./routes/predefined-quote-items')
  const { createJobsRouter } = require('./routes/jobs')
  const { createDashboardRouter } = require('./routes/dashboard')
  const { createPartsOrdersRouter } = require('./routes/parts-orders')
  const { createSearchRouter } = require('./routes/search')
  const { createAdminRouter } = require('./routes/admin')
  const { createTechniciansRouter } = require('./routes/technicians')
  const { createTechnicianSkillsRouter } = require('./routes/technician-skills')
  const { createBaysRouter } = require('./routes/bays')
  const { createReportsRouter } = require('./routes/reports')
  const { createCommunicationsRouter } = require('./routes/communications')
  const { createCalendarRouter } = require('./routes/calendar')
  const { createAuthRouter } = require('./routes/auth')
  const { createActivityRouter } = require('./routes/activity')
  const { createMotEventsRouter } = require('./routes/mot-events')
  const { createMotRouter, startMotScheduler } = require('./routes/mot')
  const { createInvoicesRouter } = require('./routes/invoices')
  const { createInventoryRouter } = require('./routes/inventory')
  const { createSettingsRouter } = require('./routes/settings')
  const { createNotificationsRouter } = require('./routes/notifications')
  const { createRemindersRouter } = require('./routes/reminders')
  const { createTemplatesRouter } = require('./routes/templates')
  const {
    createCustomerDetailRequestsRouter,
  } = require('./routes/customer-detail-requests')

  const db = await createDb()
  const requireAuth = createAuthMiddleware({ db })

  app.use(async (req, _res, next) => {
    try {
      req.authUser = await getSessionUser(db, req)
    } catch {
      req.authUser = null
    }
    next()
  })

  const publicDir = path.join(__dirname, 'public')
  const indexHtmlPath = path.join(publicDir, 'index.html')

  app.get('/api/health', async (req, res) => {
    let dbOk = true
    let dbError = null
    try {
      await db.ping()
    } catch (err) {
      dbOk = false
      dbError = String(err && err.message ? err.message : err)
    }

    res.json({
      ok: true,
      app: 'Automotive Super Software',
      version: rootPackage.version || '0.0.0',
      environment: process.env.NODE_ENV || 'development',
      db: {
        client: getDbClient(),
        ok: dbOk,
        error: dbOk ? null : dbError,
      },
      frontend: {
        served: fs.existsSync(indexHtmlPath),
      },
      time: new Date().toISOString(),
    })
  })

  app.use('/api/customers', createCustomersRouter({ db }))
  app.use('/api', createAuthRouter({ db }))
  app.use('/api/vehicles', createVehiclesRouter({ db }))
  app.use('/api', createServicesRouter({ db }))
  app.use('/api/availability', createAvailabilityRouter({ db }))
  app.use('/api', createIntakeRouter({ db }))
  app.use('/api', createQuotesRouter({ db }))
  app.use('/api', createSuppliersRouter({ db }))
  app.use('/api', createSetupRouter({ db }))
  app.use('/api', createPredefinedQuoteItemsRouter({ db }))
  app.use('/api', createJobsRouter({ db }))
  app.use('/api', createDashboardRouter({ db }))
  app.use('/api', createPartsOrdersRouter({ db }))
  app.use('/api', createSearchRouter({ db }))
  app.use('/api', createTechniciansRouter({ db }))
  app.use('/api', createTechnicianSkillsRouter({ db }))
  app.use('/api', createBaysRouter({ db }))
  app.use('/api', createReportsRouter({ db }))
  app.use('/api', createCommunicationsRouter({ db }))
  app.use('/api', requireAuth, createActivityRouter({ db }))
  app.use('/api', createCustomerDetailRequestsRouter({ db }))
  app.use('/api', requireAuth, requireRole(['admin', 'office']), createAdminRouter({ db }))
  app.use('/api', createCalendarRouter({ db }))
  app.use('/api', createMotEventsRouter({ db }))
  app.use('/api', createMotRouter({ db }))
  app.use('/api', createInvoicesRouter({ db }))
  app.use('/api', createInventoryRouter({ db }))
  app.use('/api', createSettingsRouter({ db }))
  app.use('/api', createNotificationsRouter({ db }))
  app.use('/api', createRemindersRouter({ db }))
  app.use('/api', requireAuth, requireRole(['admin', 'office']), createTemplatesRouter({ db }))

  startMotScheduler({ db })

  // In production, serve the built React app from `backend/public/`.
  // Non-API routes should return index.html so browser refresh works on SPA routes.
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(publicDir))

    app.get(/^\/(?!api).*/, (req, res) => {
      if (!fs.existsSync(indexHtmlPath)) {
        return res
          .status(500)
          .send(
            'Frontend build not found. Run the build + copy step to populate backend/public/.',
          )
      }
      res.sendFile(indexHtmlPath)
    })
  }

  // Safe JSON error handler (helps the frontend show useful messages).
  // Avoid leaking secrets: we only return the error message and a generic hint.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = Number(err && (err.statusCode || err.status)) || 500
    res.status(status).json({
      ok: false,
      error: 'The backend returned an error.',
      details: String(err && err.message ? err.message : err),
      hint: 'Database setup may be required. Open Set-up and run status/init/seed.',
    })
  })

  // Simple JSON 404 for unknown routes.
  app.use((req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' })
  })

  const port = Number(process.env.PORT || 3001)

  const server = app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`)
  })

  function shutdown(signal) {
    // eslint-disable-next-line no-console
    console.log(`Shutting down (${signal})...`)
    try {
      server.close(() => {
        Promise.resolve(db.close && db.close())
          .catch(() => {})
          .finally(() => process.exit(0))
      })
    } catch {
      process.exit(0)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
