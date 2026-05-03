# n8n Vehicle Lookup Webhook (DVLA + DVSA)

This folder contains an importable n8n workflow that powers server-side vehicle lookups for Automotive Super Software.

The backend calls n8n (not the browser) when a registration is not found in the MySQL/MariaDB database.

## Files

- `docs/n8n/checkvehiclecreate.workflow.json` — n8n workflow export (import this into n8n)

## n8n environment variables (no hardcoded secrets)

Set these in n8n (Settings → Variables / Environment variables), **not** in the workflow JSON:

- `DVLA_API_KEY`
- `DVSA_API_KEY`
- `DVSA_TOKEN_URL`
- `DVSA_CLIENT_ID`
- `DVSA_CLIENT_SECRET`
- `DVSA_SCOPE`

Optional (recommended) shared secret (to match backend `N8N_CHECK_VEHICLE_SHARED_SECRET`):

- `AUTOSS_WEBHOOK_SECRET`

Optional (if your DVSA MOT endpoint differs / changes):

- `DVSA_MOT_ENDPOINT`
  - If unset, the workflow includes a clearly marked placeholder URL you must edit.

## Import the workflow

1. In n8n, go to **Workflows** → **Import from File**
2. Select `docs/n8n/checkvehiclecreate.workflow.json`
3. Open the imported workflow and review the HTTP request nodes.
4. Set any missing environment variables.
5. Activate the workflow.

## Webhook details

- Path: `checkvehiclecreate`
- Method: `POST`
- Body JSON:

```json
{ "registration": "AB12CDE" }
```

If you use a shared secret, send:

- Header: `X-AUTOSS-WEBHOOK-SECRET: <value>`

## Manual test (example)

Replace the base URL with your n8n domain:

```bash
curl -sS -X POST "https://automationplatform.business-automations.uk/webhook/checkvehiclecreate" \
  -H "Content-Type: application/json" \
  -d '{"registration":"AB12CDE"}'
```

## Backend expected response shape

The backend expects the workflow to respond with:

```json
{
  "ok": true,
  "source": "n8n",
  "vehicle": {
    "registration": "AB12 CDE",
    "make": "BMW",
    "model": "320d",
    "year": 2016,
    "fuel_type": "Diesel",
    "engine_size": "2.0L",
    "colour": "Black",
    "mot_status": "Valid",
    "mot_expiry": "2026-11-18",
    "last_mot_date": "2025-11-10",
    "last_recorded_mileage": 86400
  },
  "mot": {
    "tests": [],
    "failures": [],
    "advisories": []
  }
}
```

The backend will upsert the returned vehicle into MySQL/MariaDB.

## Important request details (headers/bodies)

These are the exact request shapes used by the workflow (easy to check in the node settings).

### DVLA Vehicle Enquiry API

- Method: `POST`
- URL: `https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`
- Headers:
  - `x-api-key: {{$env.DVLA_API_KEY}}`
  - `Content-Type: application/json`
- Body JSON:
  - `{ "registrationNumber": "AB12CDE" }` (the workflow uses the normalised `regNorm`)

### DVSA OAuth token

- Method: `POST`
- URL: `{{$env.DVSA_TOKEN_URL}}`
- Headers:
  - `Content-Type: application/x-www-form-urlencoded`
- Body (form-urlencoded fields):
  - `grant_type=client_credentials`
  - `client_id={{$env.DVSA_CLIENT_ID}}`
  - `client_secret={{$env.DVSA_CLIENT_SECRET}}`
  - `scope={{$env.DVSA_SCOPE}}`

### DVSA MOT History

The exact DVSA MOT endpoint can vary; the workflow intentionally uses an environment variable so you can update it without editing the workflow JSON:

- URL: `{{$env.DVSA_MOT_ENDPOINT}}` (or edit the placeholder URL in the node)

Headers:

- `Authorization: Bearer <access_token>` (from the DVSA OAuth node)
- `X-API-Key: {{$env.DVSA_API_KEY}}`
- `Accept: application/json+v6`

Query parameter:

- `registration=AB12CDE`

## Notes about `$env` in n8n

- n8n reads environment variables at runtime; if you add new env vars, you may need to restart n8n for them to be visible to executions.
- In some n8n UIs, `$env.*` values may not preview in the editor, but they should work during execution once the environment variables exist on the n8n server.
