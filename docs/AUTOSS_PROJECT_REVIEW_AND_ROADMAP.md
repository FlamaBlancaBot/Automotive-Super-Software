# Automotive Super Software / AUTOSS — Project Review and Roadmap

## 1. Current Project Snapshot
- **Current version:** `1.1.037` (from `frontend/src/config/version.js`)
- **Purpose:** Internal garage/workshop management platform covering intake, workshop operations, quoting, parts, invoicing, and management reporting.
- **Stack:**
  - Frontend: React + Vite
  - Backend: Express + Node.js
  - Production database: MySQL/MariaDB
- **Deployment flow:** GitHub `main` auto-deploys to Hostinger.
- **Build/runtime notes used in this project:**
  - Root build command: `npm run build`
  - Build output directory: `backend/public`
  - Backend entry file: `backend/server.js`
- **Primary workshop workflow:**
  1. Onboarding / New Intake
  2. Job creation and management
  3. Quote creation and refinement
  4. Customer acceptance
  5. Parts orders workflow
  6. Job sheet completion
  7. Invoice generation

## 2. Development Guardrails
- `frontend/src/pages/QuoteDetail.jsx` is fragile and must not be touched unless explicitly required.
- Do not commit generated build output (`frontend/dist`, generated `backend/public` assets).
- Do not commit `.env`, `.env.*`, secrets, or credentials.
- Preserve customer-facing quote/invoice/job sheet document behaviour.
- Use British spelling in user-facing text/content where applicable.
- Commit and push only after real scoped changes are complete and validated.

## 3. Implemented Features So Far

### Core app
- App shell with sidebar + top bar
- Version display in UI
- Login/testing user selector/session flow
- Dashboard
- Search page
- Settings and template management foundations

### Workflow
- Onboarding wizard / New Intake flow
- Vehicle lookup + customer/job creation path
- Customer details request card/link flow
- Job Detail page
- Quote workflow
- Customer accepts quote flow
- Parts Orders workflow
- Job Sheet flow
- Invoice detail/print flow

### Workshop planning
- Calendar page
- Multi-day job spans
- START / CONTINUES / ENDS style span indicators
- Technician assignment foundation
- Job activity timeline/events
- Workshop bays foundation
- MOT bay support
- Technician skills foundation
- Bay technician assignments
- Job bay assignments

### Admin/management
- Technician management
- Skills catalogue management
- Bay management
- Communication templates foundation
- Reports/dashboard foundation

### Communications
- Communications centre page
- Message history and filtering
- `manual_required` status for SMS/email when no provider is connected
- Communication template library
- Job-level communication timeline in Job Detail
- Customer details request communication logging

### Reports
- Reports page
- KPI cards
- Revenue chart/trend block
- Technician metrics
- Bay utilisation
- Services breakdown
- Customer retention
- Parts overview
- Profit/margin placeholder with explicit non-faked data handling

## 4. Backend/Data Model Overview
Important data structures include:
- `customers`
- `vehicles`
- `jobs`
- `quotes`
- `invoices`
- Parts/orders tables (`parts_orders`, `goods_received`, `part_status_logs`)
- `technicians`
- `job_technician_assignments`
- `job_activity_events`
- `technician_skills`
- `technician_skill_assignments`
- `workshop_bays`
- `bay_technician_assignments`
- `job_bay_assignments`
- `communication_templates`
- `communication_messages`
- `communication_events`

If unsure about any table/column contract, confirm in schema before changing.

## 5. Current Pages and Navigation
Current important pages/routes in active workflow:
- Dashboard
- Search
- Onboarding / New Intake
- Jobs
- Job Detail
- Quotes / Quote Detail
- Parts Orders
- Calendar
- MOT
- Reports
- Communications
- Settings
- Invoice Detail
- Job Sheet Detail

## 6. Known Issues / Things to Verify
- Hostinger deploy/cache can briefly show an older version number after deploy.
- After schema updates, production DB tables must exist before new UI features are expected to work.
- Verify sidebar `v1.1.029` behaviour on smaller laptop screens.
- Re-verify Settings Technicians/Bays after schema-related releases.
- Re-verify Reports after schema changes.
- Re-verify Communications message creation and `manual_required` behaviour.
- Search page may still benefit from deeper UI polish.
- Always test Quote page after major layout/CSS changes, even when untouched.

## 7. Requested Future Features / Roadmap

### Near-term
- Fully test and harden technician/bay/settings workflows
- Improve Search Results UI polish and usability
- Login/setup polish and onboarding consistency
- Responsive + light-mode QA pass across key pages
- Improve onboarding booking logic with bay availability
- Show bay/technician availability more directly in calendar
- Support skill-based technician suitability guidance

### Next major features
- Advanced scheduling with drag/drop interactions
- Capacity planning by bay and technician
- Real SMS/email provider integration in communications
- Quote approval links and customer portal improvements
- Payment tracking and deposit handling
- Invoice reminders workflow refinement
- Reports enhancements with reliable margins and labour profitability
- Vehicle service history and maintenance planner
- Photo/video inspection reports
- Advanced inventory management foundation (implemented in v1.1.036)
- Parts stock/reorder/supplier integration foundation (implemented in v1.1.036)
- QuickBooks/accounting export foundation
- Team collaboration features (`@mentions`, handover notes, clock-in/out)

### Later integrations
- DVLA/DVSA/MOT automation improvements
- MOT result polling
- Stripe/Square payments
- QuickBooks/Xero export
- SMS/email providers
- Barcode/QR scanning
- Document vault/uploads
- Customer portal

## 8. Recommended Next Build Order
1. Test and harden v1.1.025–v1.1.029 database-backed features
2. Search Results UI polish
3. Login/setup polish
4. Booking availability using bays + technicians
5. Calendar capacity planning
6. Real customer communication sending
7. Payment/financial tracking foundation
8. Vehicle history/maintenance planner
9. Inventory stock management
10. Photo/video inspection reports
11. Accounting export foundation

## 9. Testing Checklist Before Each Release
- Run `npm run build`
- Run `node --check` for changed backend route files
- Run `git status` before commit
- Verify no secrets/build artefacts are staged
- Smoke test dashboard/jobs/onboarding/calendar/quote/settings
- Test new feature behaviour on Hostinger
- Confirm top bar version matches expected release

## 10. Agent Handoff Notes
- Inspect current files before editing, including related docs and recent commits.
- Avoid broad rewrites when a scoped fix is safer.
- Prefer small, production-safe phased delivery.
- Update docs after significant features.
- Commit and push each completed feature phase.
- In final reports, include: files changed, build result, commit hash, push status, and Hostinger test checklist.

## Stability hardening update (v1.1.030)
- Added accepted-quote-safe revision/additional quote workflow so original accepted quotes are not overwritten.
- Added registration/job context hardening for quote listing/detail responses where links exist.
- Communications UI moved to clearer manager-facing structure (manual mode banner, summary cards, tabs).
- Continued roadmap priority: harden workflow data consistency across quotes/jobs/invoices and add stronger relational diagnostics for missing vehicle/customer links.

## Deployment incident note (v1.1.031)
- A production 503 incident was traced to a backend startup failure from stray top-level `await` code left at the end of `backend/routes/quotes.js`.
- Hotfix v1.1.031 removed the orphaned lines and restored server startup.
- Release verification should include backend runtime start checks after quote-route edits, not only syntax checks.

## Booking availability foundation (v1.1.032)
- Added database-backed availability suggestions endpoint for requested slot, bays, technicians, skills, and conflict summaries.
- Onboarding booking step now shows structured bay/technician suggestions and warnings instead of basic busy/free text only.
- Job Detail now includes scheduling suggestions with refresh and optional one-click assignment using existing bay/technician endpoints.
- Calendar capacity planner foundation added in v1.1.033 with day-level workload and assignment warnings.
- Drag/drop scheduling and fully automatic assignment remain future work.
- Payment and financial tracking foundation added in v1.1.034 (deposits/partial/final/refund records, balances, payment statuses, and reporting metrics).
- Stripe/Square/QuickBooks live integrations remain future work.
- Vehicle service history and maintenance planner foundation added in v1.1.035 (registration-centred timeline, recommendations, and document metadata records).
- Advanced inventory management foundation added in v1.1.036 (inventory catalog, stock movements, low-stock/expiry tracking, supplier pricing, and job usage logging).
- MOT result polling foundation added in v1.1.036 (arrival-based delayed polling schedule, retry cadence, MOT fault mapping, and result notifications).
- Platform notifications and reminders foundation added in v1.1.036 (in-app notification center, mark-read flow, reminders API base, and MOT-triggered alerts).
- Manufacturer-specific schedules, real document upload storage, and deeper DVSA/MOT automation remain future work.
- Barcode/QR scanning, live supplier integrations, and automatic quote-part to inventory mapping remain future work.
- Full reminder automation workflows and richer reminder UI automation remain future work.
- Future work remains: drag/drop scheduling, live capacity heatmaps, and fully automatic assignment decisions.
- MOT live-test hardening applied in v1.1.038 (manual checks no longer interfere with automatic retry schedule, and Current booked MOT vs Previous/last known MOT are shown separately).
- MOT quick-add/watch-list foundation implemented in v1.1.039.
- MOT-to-quote repair builder implemented in v1.1.039 (selected faults to draft quote only).
- Future work: richer MOT job/customer linking, customer approval portal for selected MOT repairs, and pricing templates for common MOT failures.
- MOT live-test bugfix applied in v1.1.040: repaired run-now 500 handling, quick-add reliability, and scheduler visibility/diagnostics endpoints.
