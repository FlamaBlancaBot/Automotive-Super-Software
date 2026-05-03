export function toOperationalUpper(value) {
  return String(value || '').trim().toUpperCase()
}

export function normaliseOperationalText(value) {
  return toOperationalUpper(value)
}

export function cleanPhone(value) {
  return String(value || '')
    .replace(/[^\d +]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function normaliseReg(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 9)
}
