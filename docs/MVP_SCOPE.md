# MVP Scope (First Usable Release)

Last updated: 2026-04-25

## MVP goal

Deliver a secure internal web app that lets staff:

- log in safely,
- find/create a vehicle by REG,
- create and manage jobs for that vehicle,
- track job status and assignments,
- keep an audit trail of important changes.

This MVP is deliberately small so we can ship something reliable and improve it in increments.

## Users and permissions (MVP)

### Roles

- **admin**
- **office_staff**
- **technician**

### Permission summary (MVP)

| Capability | admin | office_staff | technician |
|---|---:|---:|---:|
| Log in/out | ✅ | ✅ | ✅ |
| Manage users/roles | ✅ | ❌ | ❌ |
| Create/edit customers | ✅ | ✅ | ❌ (view only) |
| Create/edit vehicles | ✅ | ✅ | ❌ (view only) |
| Create jobs | ✅ | ✅ | ❌ |
| Edit job details (summary, booked time) | ✅ | ✅ | ❌ (notes/status only) |
| Assign technician | ✅ | ✅ | ❌ |
| Update job status | ✅ | ✅ | ✅ (own jobs only) |
| Add job notes | ✅ | ✅ | ✅ (own jobs only) |
| View audit log | ✅ | ✅ (limited) | ❌ |

Notes:

- “Own jobs” means jobs assigned to that technician.
- Office staff can do most operational actions; admin is for setup and oversight.

## What’s in scope (MVP)

### 1) Authentication and account management

- Admin creates user accounts and sets roles.
- Users can log in and log out.
- Basic account controls: deactivate user, force password reset (recommended).

### 2) Vehicle + customer records (REG-first)

- Search for a vehicle by REG (case-insensitive, spaces ignored).
- Create a vehicle if not found.
- Store basic customer details linked to the vehicle (keeper/contact).

Minimum vehicle fields (editable later):

- REG (display + normalised)
- Make / Model (optional in MVP)
- Customer (optional at first, but recommended)

### 3) Job creation and management

- Create a job for a vehicle.
- Job statuses with history:
  - `new`
  - `booked_in`
  - `in_progress`
  - `awaiting_parts`
  - `awaiting_authorisation`
  - `complete`
  - `cancelled`
- Assign a technician (manual selection).
- Add notes to a job.
- Record a booked date/time against a job (simple fields; calendar view can be later).

### 4) Views/screens (MVP)

Keep the UI basic:

- Login page
- Vehicle search page
- Vehicle details page (with linked jobs)
- New job form
- Job detail page (status, notes, assignment, booking time)
- “Jobs by status” list (simple board/table)
- Admin user management page (minimal)

### 5) Audit logging (MVP)

Record at least:

- user logins/logouts (and failures)
- user creation/deactivation/role changes
- vehicle/customer create/update
- job create/update
- job status changes and assignment changes

## What’s out of scope (MVP)

These are explicitly deferred to keep the first release achievable:

- DVLA/DVSA integrations (vehicle lookup, MOT history, result checking)
- n8n automation and webhooks
- Full Kanban drag-and-drop board
- Calendar/capacity planner UI (beyond storing booking timestamps)
- Technician capability profiles and assignment suggestions
- Quotes and multi-supplier part comparison
- Goods received workflow
- Printable/digital job sheets
- File uploads/attachments
- Customer messaging (SMS/email)
- Multi-site or multi-tenant support

## MVP build order (clear stages)

Build in this order so we don’t paint ourselves into a corner:

### Stage 0 — Planning (now)

- Finalise `docs/PROJECT_PLAN.md`, `docs/MVP_SCOPE.md`, `docs/DATABASE_PLAN.md`

### Stage 1 — Data model first

- Create database schema and migrations for:
  - users
  - vehicles
  - customers
  - jobs
  - job notes/status history
  - audit log

### Stage 2 — Backend foundations

- Express API skeleton
- Authentication + session handling
- Role-based access checks on every route
- Input validation (especially REG normalisation)

### Stage 3 — Core CRUD

- Vehicles: search/create/edit
- Customers: create/edit (linked to vehicles)
- Jobs: create/edit/status change/assign
- Notes: add/list

### Stage 4 — Basic UI

- Implement the MVP pages listed above
- Keep the interface simple and readable (no complex component libraries required)

### Stage 5 — Polish and release hardening

- Audit log views (admin/office)
- Rate limiting on login
- Secure headers (CSP/helmet-style)
- Backup + restore test (document the process)

## Acceptance criteria (MVP)

The MVP is “done” when:

- Admin can create an office staff account and a technician account.
- Office staff can log in, search by REG, and create a vehicle record if not found.
- Office staff can create a job for that vehicle, assign a technician, and set a booking time.
- Technician can log in, view their assigned jobs, add notes, and move the job through statuses.
- Key actions are recorded in the audit log with a user and timestamp.
- No secrets are committed to the repository and the app can be configured via environment variables.
