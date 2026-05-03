import { APP_SHORT_NAME } from '../config/branding'

// Browser title helper.
//
// We centralise this so future pages can set titles consistently, e.g.:
// - Dashboard | A.S.S
// - AB12 CDE - BMW 320d | A.S.S
// - AB12 CDE - MOT Booking | A.S.S

export function formatAppTitle(leftSide) {
  const left = String(leftSide || '').trim()
  if (!left) return APP_SHORT_NAME
  return `${left} | ${APP_SHORT_NAME}`
}

export function setDocumentTitle(leftSide) {
  document.title = formatAppTitle(leftSide)
}

export function formatVehicleTitle(regDisplay, vehicleSummary) {
  return formatAppTitle(`${regDisplay} - ${vehicleSummary}`)
}

export function formatRegActionTitle(regDisplay, action) {
  return formatAppTitle(`${regDisplay} - ${action}`)
}

