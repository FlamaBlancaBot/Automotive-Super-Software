// API base URL for the frontend.
//
// Local development:
// - backend: http://localhost:3001
//
// Production later:
// - when served by the same Express app, this should be empty (same origin).
//
// IMPORTANT:
// - For the single-domain Hostinger Node.js deploy, leave `VITE_API_BASE_URL` empty.
// - If API calls fail on the live site, database setup may be required (open Set-up).

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001' : '')
