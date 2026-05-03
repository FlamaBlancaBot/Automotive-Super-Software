// Centralised branding settings for the frontend.
//
// Keep this tiny and boring. The idea is to have one obvious place to:
// - set names shown across the app
// - point to default logo assets
// - stay ready for admin-uploaded logo/favicon later

// Short name used in the header and browser titles.
export const APP_SHORT_NAME = import.meta.env.VITE_APP_SHORT_NAME || 'A.S.S'

// Long name used as a subtitle and in docs.
export const APP_LONG_NAME =
  import.meta.env.VITE_APP_LONG_NAME ||
  import.meta.env.VITE_APP_NAME ||
  'Automotive Super Software'

export const TAGLINE =
  import.meta.env.VITE_TAGLINE || 'Secure internal garage management'

// Keep these as public URL strings (not imported files) so you can swap assets
// in `frontend/public/` later without changing code.
export const LOGO_URL = import.meta.env.VITE_LOGO_URL || '/brand/logo.png'
