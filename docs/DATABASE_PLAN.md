# Database Plan (MySQL/MariaDB)

Last updated: 2026-04-25

## 1) Goals

- Support the MVP workflows (users, vehicles, jobs, audit log) without overcomplication.
- Be compatible with Hostinger’s MySQL/MariaDB offering.
- Keep data model centred on **vehicle registration numbers (REGs)**.
- Make it easy to add DVLA/DVSA and automation later (via n8n or direct integrations).

## 2) Assumptions and compatibility

- Database: **MySQL 8+** or **MariaDB 10.6+** (confirm the exact Hostinger version early).
- Storage engine: **InnoDB** (for transactions + foreign keys).
- Character set: **utf8mb4**.
- Collation: pick one that exists on your server; a safe default is `utf8mb4_unicode_ci`.
- Timestamps: store in **UTC**; display in local time in the UI.

## 3) Conventions (keep it consistent)

- Table names: `snake_case`, plural (e.g. `job_notes`).
- Primary keys: `id` as `BIGINT UNSIGNED` auto-increment.
- Foreign keys: `<table>_id` (e.g. `vehicle_id`).
- Common columns:
  - `created_at` (DATETIME)
  - `updated_at` (DATETIME)
- Avoid hard deletes for important records:
  - prefer `is_active` or status fields
  - if we later need soft deletes, add `deleted_at`

## 4) REG normalisation (critical)

We store two versions of the registration number:

- `reg_display` — what users expect to see (may include spaces).
- `reg_normalised` — canonical value used for searching and uniqueness.

Normalisation rule (applied in backend code, not only in the UI):

- trim whitespace
- uppercase
- remove spaces and hyphens

Example:

- `“ab12 cde”` → `reg_normalised = “AB12CDE”`, `reg_display = “AB12 CDE”` (display formatting can be refined later)

Add a **unique index** on `vehicles.reg_normalised` so duplicates cannot exist.

## 5) MVP tables (v0)

These tables are enough for the first usable release.

### 5.1 `users`

Purpose: internal staff accounts.

Suggested columns:

- `id`
- `email` (unique, stored lowercased)
- `full_name`
- `role` (e.g. `admin`, `office_staff`, `technician`)
- `password_hash` (never store plaintext passwords)
- `is_active` (boolean)
- `last_login_at` (nullable)
- `created_at`, `updated_at`

Indexes:

- `UNIQUE(email)`
- `INDEX(role)`

### 5.2 `auth_sessions`

Purpose: server-managed sessions (recommended for a secure internal tool).

Suggested columns:

- `id` (random session identifier; not guessable)
- `user_id` (FK → `users.id`)
- `created_at`
- `expires_at`
- `revoked_at` (nullable)
- `ip_address` (nullable)
- `user_agent` (nullable)

Indexes:

- `INDEX(user_id)`
- `INDEX(expires_at)`

### 5.3 `customers`

Purpose: customer/keeper contact details (minimal to start).

Suggested columns:

- `id`
- `full_name`
- `phone` (string)
- `email` (string, nullable)
- `notes` (nullable)
- `created_at`, `updated_at`

Indexes:

- `INDEX(phone)` (optional; depends on search needs)
- `INDEX(email)` (optional)

### 5.4 `vehicles`

Purpose: vehicles identified by REG, linked to a customer.

Suggested columns:

- `id`
- `reg_display`
- `reg_normalised` (unique)
- `customer_id` (nullable FK → `customers.id`)
- `make` (nullable)
- `model` (nullable)
- `colour` (nullable; British spelling)
- `vin` (nullable)
- `created_at`, `updated_at`

Indexes:

- `UNIQUE(reg_normalised)`
- `INDEX(customer_id)`

### 5.5 `jobs`

Purpose: work items linked to a vehicle (MOT, service, repair, etc.).

Suggested columns:

- `id`
- `vehicle_id` (FK → `vehicles.id`)
- `created_by_user_id` (FK → `users.id`)
- `assigned_to_user_id` (nullable FK → `users.id`)
- `status` (e.g. `new`, `booked_in`, `in_progress`, `awaiting_parts`, `awaiting_authorisation`, `complete`, `cancelled`)
- `summary` (short text)
- `booked_start_at` (nullable)
- `booked_end_at` (nullable)
- `closed_at` (nullable)
- `created_at`, `updated_at`

Indexes:

- `INDEX(vehicle_id)`
- `INDEX(status)`
- `INDEX(assigned_to_user_id)`
- `INDEX(booked_start_at)`

### 5.6 `job_notes`

Purpose: human notes against a job (call notes, technician updates, etc.).

Suggested columns:

- `id`
- `job_id` (FK → `jobs.id`)
- `created_by_user_id` (FK → `users.id`)
- `note_text` (text)
- `created_at`

Indexes:

- `INDEX(job_id, created_at)`

### 5.7 `job_status_history`

Purpose: track status changes over time (useful for accountability and reporting).

Suggested columns:

- `id`
- `job_id` (FK → `jobs.id`)
- `changed_by_user_id` (FK → `users.id`)
- `from_status` (nullable; first status change)
- `to_status`
- `note` (nullable; short reason)
- `created_at`

Indexes:

- `INDEX(job_id, created_at)`

### 5.8 `audit_log`

Purpose: tamper-evident-ish record of important actions (not just jobs).

Suggested columns:

- `id`
- `actor_user_id` (nullable FK → `users.id`) — nullable for unauthenticated events (e.g. failed login)
- `action` (string; e.g. `USER_LOGIN_SUCCESS`, `JOB_STATUS_CHANGED`)
- `entity_type` (string; e.g. `job`, `vehicle`, `user`)
- `entity_id` (nullable; depends on action)
- `details_json` (nullable; store small structured context, not entire records)
- `ip_address` (nullable)
- `user_agent` (nullable)
- `created_at`

Indexes:

- `INDEX(created_at)`
- `INDEX(actor_user_id, created_at)`
- `INDEX(entity_type, entity_id)`

## 6) Security and data protection notes

- Store **password hashes only** (`users.password_hash`).
- Treat customer data as personal data (GDPR): minimise fields, restrict access by role.
- Avoid logging sensitive fields (never log passwords; be careful with addresses/phone numbers).
- Consider encrypting backups and restricting database access by IP where possible.

## 7) Later tables (post-MVP)

We will add these when the MVP is stable:

- `quotes`, `quote_items`
- `parts`, `supplier_options`, `goods_received`
- `appointments` (if bookings outgrow simple `booked_*` fields on `jobs`)
- `technician_profiles`, `technician_capabilities`
- `attachments` (job sheets, images, documents)
- `vehicle_lookup_cache` (DVLA/DVSA response caching)
- `mot_history_cache`
- `notifications`, `reminders` (for automation)

## 8) Migration strategy (recommended)

Keep it beginner-friendly:

- Use numbered SQL migration files (e.g. `001_create_users.sql`, `002_create_vehicles.sql`)
- Each migration is:
  - applied once
  - recorded in a `schema_migrations` table
- Run migrations manually as a deploy step (not automatically on every app start).
