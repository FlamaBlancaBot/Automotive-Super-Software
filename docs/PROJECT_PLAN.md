# Automotive Super Software — Project Plan

Last updated: 2026-04-25

## 1) What this app is

Automotive Super Software is a secure internal garage management web app designed to replace TechMan-style day-to-day workflows over time.

The app is **organised around UK vehicle registration numbers (REGs)**. Nearly every workflow starts by searching for a REG, then working from the vehicle record to jobs, bookings, notes, and history.

### Primary users

- **Admin**: manages users, roles, and system configuration.
- **Office staff**: handles incoming calls, bookings, customer comms, and quote/job admin.
- **Technicians**: views assigned work, updates job status, and records work done.

### What it is not (for now)

- Not a public customer portal.
- Not an accounting package.
- Not a parts supplier marketplace (we’ll record options, but not build full procurement integrations initially).

## 2) Guiding principles (keep it simple)

- **Security first**: internal does not mean insecure.
- **Small, working increments**: ship a minimal MVP, then iterate.
- **Beginner-friendly structure**: predictable folders, few moving parts.
- **British spelling** throughout the product and documentation.
- **No fake secrets** committed to the repo (no “example API keys”).

## 3) Planned architecture (high level)

This repo is intentionally a simple monorepo:

- `frontend/` — React + Vite (later)
- `backend/` — Node.js + Express (later)
- `database/` — SQL migrations, seed scripts, and schema notes (later)
- `docs/` — planning and operational documentation (now)

Communication style (later):

- Backend exposes a small REST API for the frontend.
- Authentication uses secure, server-managed sessions (recommended for an internal tool).

Database (later):

- MySQL/MariaDB (Hostinger-friendly), using `utf8mb4`.

## 4) User roles (initial)

Roles are intentionally simple to start:

- **admin**
  - Create/deactivate users
  - Change roles
  - View all audit logs
  - Configure basic settings (working hours, MOT slot length, etc.)
- **office_staff**
  - Create/update customers and vehicles
  - Create bookings/jobs, move jobs through statuses
  - Assign technicians (manual initially)
  - Generate/print job sheets (later)
- **technician**
  - View assigned work and upcoming bookings
  - Update job status, add notes, record parts used (later)
  - Cannot change users/roles

## 5) Main workflows (long-term)

These describe the end-state workflows we’ll build towards. The MVP will only implement a small subset.

### A) Vehicle-first lookup

1. Search by REG (accepts spaces and mixed case)
2. If found: open vehicle page
3. If not found: create vehicle record (manual entry at first)
4. From the vehicle: view MOT history (later), past jobs, notes, and upcoming bookings

### B) Phone call intake (office staff)

1. Search REG → open/create vehicle
2. Capture caller details and the reason for the call
3. Create a job (quote, MOT, service, repair)
4. Book into diary/capacity (MVP may be “basic booking” only)

### C) Job lifecycle / workshop flow

Typical states (subject to change):

`new → booked_in → in_progress → awaiting_parts → awaiting_authorisation → complete`

With:

- technician assignment
- notes / updates
- time booking (later)
- printable/digital job sheet (later)

### D) MOT booking and result checking (later)

- Book MOT slots
- Record pass/fail/advisories
- Optionally pull MOT history via DVSA when integrations are added

### E) Kanban board (later)

- Jobs displayed by status columns
- Drag-and-drop (later) or simple status updates (earlier)

### F) Calendar/capacity planner (later)

- Day/week view with bookings
- Slot rules (MOT length, tech availability, opening hours)
- Technician capability matching (later)

### G) Audit log (from day one)

- Track key actions: logins, job changes, status changes, edits to vehicle/customer details
- Admin can review for accountability and debugging

## 6) MVP build order (recommended)

The goal is a small but solid internal tool. Build in this order:

1. **Foundations**
   - Database schema + migrations
   - Backend project skeleton (no features beyond health check)
2. **Security + access**
   - Admin-created users (no self-signup)
   - Login/logout
   - Role-based access control (admin / office_staff / technician)
   - Audit log framework
3. **Vehicle + customer records**
   - Search by REG (normalised)
   - Create/edit vehicle and customer
4. **Jobs**
   - Create job for a vehicle
   - Basic job statuses + status history
   - Assign technician (manual)
   - Notes
5. **Simple “work in progress” view**
   - List/board view of jobs by status (no fancy Kanban yet)
6. **Bookings (lightweight)**
   - Store a booked date/time against a job (calendar UI later)

Everything else is explicitly “later”.

See `docs/MVP_SCOPE.md` for the detailed MVP definition and acceptance criteria.

## 7) Security requirements (baseline)

Minimum baseline requirements for the first usable release:

- **Authentication**
  - Passwords stored as strong hashes (e.g. Argon2id or bcrypt with appropriate cost)
  - No plaintext passwords ever stored or logged
  - Admin creates accounts; initial password must be changed on first login (recommended)
- **Authorisation**
  - Every API route checks the user role
  - “Technician” cannot edit user accounts, roles, or system settings
- **Session security**
  - Use HTTP-only, secure cookies
  - Short session lifetime with rolling expiry (configurable)
  - Logout invalidates the session server-side
- **Input validation**
  - Validate and normalise REGs (uppercase, remove spaces for matching)
  - Validate emails/phone numbers; never trust client input
- **Auditability**
  - Record who changed what and when (at least for jobs, vehicles, customers, and user actions)
- **Operational security**
  - HTTPS only
  - Environment variables for secrets; never commit secrets to git
  - Database user has least privileges needed by the app
  - Backups enabled and tested (restore process documented)

## 8) Deployment (later, Hostinger subdomain)

When we deploy, we will:

- Run the backend behind HTTPS on a subdomain (e.g. `garage.example.com`)
- Connect to Hostinger MySQL/MariaDB
- Use environment variables (no secrets in the repo)
- Run migrations as a controlled step (not automatically on every request)

## 9) Key decisions to make (before coding)

- **Session strategy**: server-side sessions (recommended) vs JWT.
- **Migrations strategy**: plain SQL files vs a migration tool.
- **Data retention**: how long to keep audit logs and job history.
- **Integrations**: DVLA/DVSA access method (direct vs via n8n) and caching approach.
