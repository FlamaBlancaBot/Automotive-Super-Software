# Hostinger Node.js Setup (Single-Domain Deploy)

This project is moving from a **static frontend-only deploy** to a **single Node.js app** that serves:

- the React frontend (static files)
- the backend API under `/api`

Live subdomain:

- `https://autoss.business-automations.uk`

Hostinger subdomain folder:

- `/home/u437809449/domains/business-automations.uk/public_html/autoss`

## 1) Confirm the subdomain

In Hostinger hPanel:

1. Confirm the subdomain exists: `autoss.business-automations.uk`
2. Confirm the document/app root points to the `autoss` folder.

## 2) Create/confirm the MySQL/MariaDB database

In Hostinger hPanel:

1. Create or confirm a MySQL/MariaDB database exists for the app.
2. Create a database user and grant privileges to that database.

## 3) Required production environment variables

Set these in hPanel → Node.js → Environment variables.

Minimum required (for app + database):

- `NODE_ENV=production`
- `DB_HOST=localhost`
- `DB_PORT=3306`
- `DB_NAME=...`
- `DB_USER=...`
- `DB_PASSWORD=...`
- `SESSION_SECRET=...`
- `SETUP_TOKEN=...` (required for `/setup`)

Integrations (not used yet, but reserved for later):

- `DVLA_API_KEY=...`
- `DVSA_API_KEY=...`
- `DVSA_TOKEN_URL=...`
- `DVSA_CLIENT_ID=...`
- `DVSA_CLIENT_SECRET=...`
- `DVSA_SCOPE=...`

Important:

- Do **not** put these values in git.
- Do **not** put secrets in the frontend.
- Do **not** upload `backend/.env` to Hostinger (use hPanel environment variables instead).

Optional (vehicle lookup via n8n webhook):

- `N8N_CHECK_VEHICLE_WEBHOOK_URL=...`
- `N8N_CHECK_VEHICLE_SHARED_SECRET=...` (optional, recommended)
- `N8N_SEND_SMS_WEBHOOK_URL=...` (placeholder for customer details SMS flow)
- `N8N_SEND_SMS_SHARED_SECRET=...` (optional)

Vehicle webhook payload expected by AUTOSS:

```json
{ "registration": "YA07WGK" }
```

AUTOSS now also supports manual refresh:
- `POST /api/vehicles/:registration/refresh`

## 4) Upload the Node.js bundle

From your local machine (this repo root):

```bash
./scripts/deploy-hostinger-node.sh
```

This script:

- builds the frontend
- copies `frontend/dist/` into `backend/public/`
- prepares `build/hostinger-node-bundle/`
- backs up the current remote `autoss` folder
- uploads the new bundle to the Hostinger subdomain folder

Note:

- The production frontend is expected to call the API on the **same origin** (no separate frontend domain).
- `VITE_API_BASE_URL` should be unset or empty for the production build.

## 5) Create/configure the Node.js app in hPanel

In Hostinger hPanel → Node.js:

1. Create/select a Node.js app for the subdomain
2. Set the **application root** to the `autoss` folder
3. Set the **startup file** to `server.js`
4. Ensure the environment variables from section (3) are set
5. Install dependencies:
   - If hPanel does not install automatically, run `npm install` in the app root
6. Restart the Node.js app

## 6) Run database init/seed on Hostinger

From the Hostinger Node.js app root (or via the hPanel terminal, if available):

Initialise tables:

```bash
npm run db:init
```

Optional seed (testing only):

```bash
npm run db:seed
```

Safe reset (testing only — refuses to run unless confirmed):

```bash
CONFIRM_DB_RESET=YES npm run db:reset:safe
```

## 7) Test the deployment

Health check (API):

- `https://autoss.business-automations.uk/api/health`

Frontend:

- `https://autoss.business-automations.uk/`

If the frontend loads but API calls fail:

- verify Node.js app is running
- verify env vars are set (especially `DB_*`)
- verify the database init script was run

If you cannot access the Hostinger terminal easily:

- open `https://autoss.business-automations.uk/setup`
- enter your `SETUP_TOKEN`
- click status → init → seed (seed is testing/demo data only)

After first init/seed:

- open `/login`
- select a testing user from the dropdown (Admin/Office/Technician or active DB users)
- continue into the app

Warning: this build uses temporary passwordless testing access. Do not use it for real staff/customer data.

When you upload a newer app version that adds tables/columns (for example quotes or parts orders), run **Init** again. It uses safe create/migrate logic (no drops, no deletes).
