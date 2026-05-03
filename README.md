# Automotive Super Software

Current distribution label: `1.1.001`

Secure internal garage management web app (in development), intended to replace TechMan-style workflows over time.

The app is organised around **UK vehicle registration numbers (REGs)**.

## Repo structure

- `docs/` — planning documents (start here)
- `frontend/` — React + Vite frontend
- `backend/` — Node.js + Express backend API
- `database/` — reserved for SQL migrations and schema files (later)

## Quick start (local development)

Prerequisites:

- Node.js 22+ and npm

Set up environment variables:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` for your MySQL/MariaDB database.
Do not upload `backend/.env` anywhere (use Hostinger hPanel environment variables in production).

Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Database (MySQL/MariaDB only)

This project now uses **MySQL/MariaDB only** (matching Hostinger production).

Initialise and seed the database (testing seed only):

```bash
cd backend
npm run db:check
npm run db:init
npm run db:seed
```

Run the backend:

```bash
cd backend
npm run dev
```

Health check:

- `GET http://localhost:3001/api/health`

Example:

```bash
curl -sS http://localhost:3001/api/health
```

Customer search example:

```bash
curl -sS "http://localhost:3001/api/customers/search?q=07123"
```

Vehicle lookup example:

```bash
curl -sS "http://localhost:3001/api/vehicles/AB12%20CDE/matches"
```

Run the frontend:

```bash
cd frontend
npm run dev
```

## Test the Onboarding locally

1. Start the backend (after seeding).
2. Start the frontend.
3. Open the app and go to `Onboarding`.

Notes:

- Vehicle lookup and customer search use the **seeded MySQL/MariaDB database**.
- Frontend API base URL is configured by `VITE_API_BASE_URL` (see `frontend/.env.example`).
- The deployed Hostinger frontend will not fully save intakes until the backend is deployed later.

## Quote Builder MVP (MySQL/MariaDB)

This is now a **fast table-style quote editor** designed for garage use (quick entry + supplier comparison).

Database tables (created/updated by `npm run db:init` or `/setup → Initialise missing tables`):

- `quotes`
- `quote_items`
- `suppliers`
- `part_supplier_options`
- `predefined_quote_items` (starter templates for fast quoting)

Key API routes:

- `GET /api/quotes`
- `GET /api/quotes/:id`
- `POST /api/quotes`
- `PATCH /api/quotes/:id` (title/notes)
- `POST /api/quotes/:id/items`
- `PATCH /api/quotes/:id/items/:itemId`
- `DELETE /api/quotes/:id/items/:itemId`
- `POST /api/quotes/:id/recalculate`
- `PATCH /api/quotes/:id/status`
- `GET /api/predefined-quote-items`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `POST /api/quote-items/:itemId/supplier-options`
- `PATCH /api/part-supplier-options/:optionId/select`
- `PATCH /api/part-supplier-options/:optionId` (edit supplier option)

Seed adds (testing only, safe and repeatable):

- suppliers: ECP, Jayar, PartsDirect (inserted if missing)
- sample quotes (only if there are zero existing quotes)
- predefined quote items (inserted if missing)

Notes:

- Supplier options support a real “Not available” state so you can record calls.
- TODO: admin-managed predefined items + service-linked suggested parts/items will be added later (no admin UI yet).

## Jobs → Quotes workflow (MVP)

Preferred workflow:

1. Create a job via `Onboarding` (creates `jobs` row)
2. From the success panel click **Create quote now** (creates or opens a draft quote linked to the job)
3. Alternatively, open `Jobs` and use **Create/Open quote** from the job list or job detail view

Key job API routes:

- `GET /api/jobs`
- `GET /api/jobs/:id`
- `POST /api/jobs/:id/quotes` (creates a draft quote linked to the job; reuses existing unless `force_new=true`)

Dashboard summary (counts only):

- `GET /api/dashboard/summary`

Note:

- After uploading a new app version, run `/setup → Initialise missing tables` to safely create/migrate schema (no drops, no deletes).

## Parts Orders + Goods Received (MVP)

Workflow:

1. Create a job via `Onboarding`
2. Create/open a quote for the job
3. Add part/service lines and select supplier options where needed
4. Change quote status to **Accepted**
5. The backend creates `parts_orders` rows for included supplier-linked lines (no duplicates if accepted again)
6. Office staff track progress in `Parts`:
   - mark pending / ordered / received
   - record **Goods received** (invoice + delivery note + checks)
   - track wrong parts / returns / credits

Database tables (created/updated by `npm run db:init` or `/setup → Initialise missing tables`):

- `parts_orders`
- `goods_received`
- `part_status_logs`

Key API routes:

- `GET /api/parts-orders`
- `GET /api/parts-orders/:id`
- `PATCH /api/parts-orders/:id`
- `PATCH /api/parts-orders/:id/status`
- `POST /api/parts-orders/:id/goods-received`

Notes:

- Parts orders are **database-backed** (no fake demo data in the UI).
- Seed adds a few example parts orders only when there are zero existing rows (safe and repeatable).

## Global Rules (current implementation)

- Operational data fields are normalised to uppercase in backend write paths (intake, quotes, parts orders, suppliers).
- Email values are kept as entered (not forced to uppercase).
- Phone values are cleaned (digits/space/plus) but not uppercased.
- Placeholder text is used for defaults; forms avoid prefilled fake values where practical.

## Theme (light/dark)

- Default theme is dark.
- Theme can be changed in `Settings -> Theme`.
- Theme is stored in `localStorage` (`autoss_theme`) for this browser only.

## Authentication foundation (roles)

- Login endpoints:
  - `GET /api/auth/users`
  - `POST /api/auth/select-user`
  - `POST /api/auth/logout`
  - `GET /api/auth/me`
- Roles: `admin`, `office`, `technician`
- Session cookies are HTTP-only and same-site.
- Current testing build uses a simple user selector on `/login` (no password prompt).
- If database users exist they appear in the selector; otherwise built-in fallback testing users are shown.
- Warning: this mode is for workflow testing only. Do not use for real staff/customer data.

## Vehicle lookup webhook payload

- Backend route: `GET /api/vehicles/:registration/matches`
- Behaviour:
  - checks MySQL first
  - if not found, calls webhook URL
  - default webhook fallback:
    - `https://automationplatform.business-automations.uk/webhook/checkvehiclecreate`
- Webhook request body is always:
  - `{ "registration": "YA07WGK" }`
- Response includes diagnostics:
  - `source: database | webhook | not_found | webhook_error`
  - `webhook_attempted: true|false`

## Settings modals / service templates

- Settings now uses modal forms for add/edit actions in key tabs.
- Service templates support list/create/update with days/hours-friendly duration entry in Settings.

## Activity log foundation

- Activity API: `GET /api/activity?entity_type=&entity_id=&limit=`
- Initial key actions logged:
  - intake created
  - quote created / item added / item updated / status changed
  - parts status changes / goods received
  - settings changes (foundation)

## Printable documents foundation

- Job Sheet: in Job Detail (`Print job sheet`)
- Customer quote preview: in Quote Detail (`Preview customer quote`, `Print quote`)
- Print styles hide app chrome (sidebar/top bar) and produce clean black-on-white output.

## Customer details request foundation

- Create request: `POST /api/customer-detail-requests`
- Public form load: `GET /api/customer-detail-requests/:token`
- Public submit: `POST /api/customer-detail-requests/:token/submit`
- Public page route: `/customer-details/:token`
- Intake can generate a request link when “Send customer details request by SMS” is ticked.
- SMS sending is still a TODO integration via n8n webhook.

## MOT workflow foundation

- New table: `mot_events`
- Intake now records a MOT event when the selected service is MOT.
- Dashboard summary includes MOT counters:
  - `mot_booked_today`
  - `mot_jobs_in_progress`
  - `mot_failed`
  - `mot_passed`

## Settings/Admin foundation

Settings now includes tabbed sections:

- Company Info
- Technicians
- Suppliers
- Service Templates
- Predefined Items
- Accounting
- Integrations
- Branding
- Theme

Backend/admin foundations added:

- `company_settings` table (safe init + seed)
- `technicians` table (safe init + seed)
- API:
  - `GET/PATCH /api/admin/company-settings`
  - `GET/POST/PATCH /api/admin/technicians`
  - `GET /api/admin/integrations-status`
  - `GET/POST/PATCH /api/admin/job-statuses`
  - `PATCH /api/suppliers/:id`
  - `PATCH /api/service-templates/:id`
  - `GET/POST/PATCH /api/predefined-quote-items`

Supplier usage areas:

- Suppliers now include usage toggles:
  - `usage_quotes`
  - `usage_parts`
  - `usage_mot`
  - `usage_diagnostics`
  - `usage_general`
- Quote supplier dropdowns prioritise suppliers enabled for quotes.

## Dashboard Calendar + Kanban tabs

- Calendar and Kanban are now dashboard tabs (removed from sidebar).
- Calendar uses:
  - `GET /api/calendar/jobs?start=YYYY-MM-DD&end=YYYY-MM-DD&includeInactive=true|false`
- Calendar shows booked/active jobs clearly and can show inactive/unbooked jobs faded when toggled.

## Vehicle lookup webhook payload

Expected webhook request payload is always:

```json
{ "registration": "YA07WGK" }
```

- Registration is normalised server-side.
- Database is checked first; webhook is fallback.
- Webhook secret header is sent only when configured in env.
- If a local vehicle record is older than 30 days (or never checked), the backend refreshes from webhook automatically.
- Manual refresh endpoint:
  - `POST /api/vehicles/:registration/refresh`
- Vehicle lookup responses now include:
  - `source: database | webhook | database_stale | not_found | webhook_error`
  - `webhook_attempted: true|false`
  - `refresh_attempted: true|false` (where relevant)

## MOT workflow v2 foundation

- MOT events API:
  - `GET /api/mot-events`
  - `POST /api/mot-events/:id/check-result`
  - `POST /api/mot-events/:id/create-repair-quote`
- Intake MOT jobs now create richer `mot_events` records (type/duration/status foundation).
- MOT result checks can update event status to:
  - `passed`
  - `failed`
  - `checking_result`
- Failed MOTs can create/open a linked draft repair quote.

Jobs page refinement:

- Quick workflow views are available in the Jobs screen:
  - All
  - Today
  - Needs Quote
  - Waiting Parts
  - In Progress
  - Completed

## Search and scenario testing

- Sidebar now includes `Search` (global database search).
- `GET /api/search?q=` returns grouped matches for:
  - vehicles
  - jobs
  - customers
  - quotes
  - parts orders
- `Vehicles`, `Calendar`, and `Kanban` pages are test-ready early versions for workflow simulation.

## Recommended test flow

1. Intake -> save job
2. Open/Create quote
3. Add lines and supplier options
4. Accept quote
5. Review parts orders
6. Record goods received / returns
7. Open Job Sheet and print

After each deployment:

1. Open `/setup`
2. Run **Status**
3. Run **Init** (safe create/migrate)
4. Run **Seed** (safe test data; no deletes)

## Frontend production build

```bash
cd frontend
npm run build
```

Build output is written to `frontend/dist/`.

## Deploy frontend to Hostinger (static)

This repo includes a simple deploy script for the Hostinger subdomain:

- URL: `https://autoss.business-automations.uk/`
- Remote folder: `/home/u437809449/domains/business-automations.uk/public_html/autoss`
- SSH alias: `hostinger-autoss` (configure in your `~/.ssh/config`)

Deploy:

```bash
./scripts/deploy-frontend-hostinger.sh
```

The script will build the frontend, check SSH connectivity, create a timestamped
remote backup, then upload `frontend/dist/` (using `rsync` if available).

## Full single-domain Node.js deploy (frontend + backend) (planned)

We are moving to a **single-domain Node.js deployment** where the backend serves:

- the built React frontend from `backend/public/`
- the API under `/api`

This is required for the live site to save real intake data.

For the single-domain deploy, the frontend calls the API on the **same origin** (no separate API base URL needed).

Preparation scripts:

- Build + copy frontend into backend public: `./scripts/prepare-backend-public.sh`
- Prepare a deployable bundle: `./scripts/prepare-hostinger-node-bundle.sh`
- Deploy the bundle to Hostinger: `./scripts/deploy-hostinger-node.sh`

Hostinger setup guide:

- `docs/HOSTINGER_NODE_SETUP.md`

## Browser-based setup (production safe)

If you cannot access the server terminal (for example on Hostinger), use:

- `/setup`

This page is protected by a required environment variable:

- `SETUP_TOKEN`

The setup page can:

- check database status (tables + counts)
- create missing tables (no drops)
- run safe seed (demo/testing data only; no deletes)

The setup page does **not** include any reset feature.

## Vehicle lookup via n8n (planned integration)

When a vehicle registration is not found in the database, the backend can call an n8n webhook and upsert the returned vehicle:

- backend env var: `N8N_CHECK_VEHICLE_WEBHOOK_URL`
- optional shared secret: `N8N_CHECK_VEHICLE_SHARED_SECRET`

n8n workflow export:

- `docs/n8n/checkvehiclecreate.workflow.json`

## Backend production deployment (later)

Deploying the backend is a separate later step and requires Hostinger Node.js
app configuration (process management, environment variables, and routing).

## Automation (later)

We will likely use **n8n** later for automations (reminders, DVLA/DVSA polling, follow-ups),
but it will not replace the main app backend.

## Branding (logo/favicon)

- Frontend config: `frontend/src/config/branding.js`
- Logo: `frontend/public/brand/logo.png`
- Favicon: `frontend/public/favicon.png`

Replace these files later when you have real branding assets.

## What’s next

For the planned MVP build order and data model, see:

- `docs/PROJECT_PLAN.md`
- `docs/MVP_SCOPE.md`
- `docs/DATABASE_PLAN.md`


## Current workflow focus (May 2026)

- `Onboarding` is now shown in the UI as **Onboarding** (route stays `/intake` for compatibility).
- Workflow is vehicle/job-centred: onboarding creates and links job context, quotes sit under jobs, parts are grouped by job/REG.
- Quote editor includes explicit **Save quote** and **Customer accepts** actions with save-state feedback.
- Parts page defaults to job/REG group cards, then expands to part-line actions.
- Job sheets are available as dedicated A4-friendly document views via `/job-sheets/:id`.
- Invoice foundation is now available:
  - `POST /api/jobs/:id/invoice`
  - `GET /api/jobs/:id/invoices`
  - `GET /api/invoices/:id`
  - `PATCH /api/invoices/:id`

Hostinger deployment remains Git-based from repository root. Do not use manual zip/dist uploads.

## Version visibility

- Current app version: `1.1.008`
- Version is shown in the top bar and returned by `/api/health`.

## Editable templates

- New template storage table: `document_templates`.
- API endpoints:
  - `GET /api/templates`
  - `GET /api/templates/:key`
  - `PATCH /api/templates/:key`
  - `POST /api/templates/:key/render`
- Template keys include:
  - `customer_quote`
  - `invoice`
  - `job_sheet`
  - `email_quote_ready`
  - `email_invoice_ready`
  - `sms_customer_details_request`
  - `sms_quote_ready`
  - `sms_vehicle_update`

## Core shortcodes

- General: `{{company.name}}`, `{{company.phone}}`, `{{company.email}}`, `{{company.address}}`, `{{company.vat_number}}`, `{{company.logo_url}}`
- Customer: `{{customer.name}}`, `{{customer.first_name}}`, `{{customer.surname}}`, `{{customer.phone}}`, `{{customer.email}}`, `{{customer.address}}`, `{{customer.postcode}}`
- Vehicle: `{{vehicle.registration}}`, `{{vehicle.make}}`, `{{vehicle.model}}`, `{{vehicle.colour}}`, `{{vehicle.year}}`, `{{vehicle.fuel_type}}`, `{{vehicle.mileage}}`
- Job: `{{job.id}}`, `{{job.title}}`, `{{job.status}}`, `{{job.booked_start}}`, `{{job.booked_end}}`, `{{job.customer_statement}}`, `{{job.internal_notes}}`
- Quote: `{{quote.quote_number}}`, `{{quote.status}}`, `{{quote.date}}`, `{{quote.items_html}}`, `{{quote.subtotal_ex_vat}}`, `{{quote.vat_total}}`, `{{quote.total_inc_vat}}`, `{{quote.notes}}`
- Invoice: `{{invoice.invoice_number}}`, `{{invoice.status}}`, `{{invoice.date}}`, `{{invoice.items_html}}`, `{{invoice.subtotal_ex_vat}}`, `{{invoice.vat_total}}`, `{{invoice.total_inc_vat}}`, `{{invoice.notes}}`
- Job sheet: `{{job_sheet.tasks_html}}`, `{{job_sheet.parts_html}}`, `{{job_sheet.checklist_html}}`

## Navigation update

- Sidebar keeps collapsed default and reveals labels on hover.
- Sidebar no longer shows `Technicians`, `Suppliers`, or `Job Sheets` entries.

## Quote and parts workflow updates (v1.1.008)

- Parts comparison is now per-part: suppliers are added to the specific part row only.
- Pricing order in supplier cards is Cost ex VAT, Markup %, Sell ex VAT, with highlighted Inc VAT output.
- Quote customer preview/print uses rendered template content with customer-facing pricing only.
- Parts page includes ad-hoc `Order part`, `Add received part`, and `Return part` flows by REG/job.
- Seed data now includes broader realistic scenarios for in-progress/accepted/no-quote jobs and invoice examples.
