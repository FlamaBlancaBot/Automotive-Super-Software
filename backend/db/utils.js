'use strict'

function normaliseRegistration(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()
}

function isLikelyUkRegistration(regNorm) {
  const reg = normaliseRegistration(regNorm)
  // Operationally keep this broad enough for private/import/demo plates,
  // but reject obvious bad payloads such as "[object Object]".
  return reg.length >= 2 && reg.length <= 8 && /^[A-Z0-9]+$/.test(reg)
}

function toOperationalUpper(input) {
  return String(input || '').trim().toUpperCase()
}

function cleanPhone(input) {
  return String(input || '')
    .replace(/[^\d +]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function nowIso() {
  return new Date().toISOString()
}

function toDbDateTime(iso) {
  // Store as "YYYY-MM-DD HH:MM:SS" for MySQL/MariaDB DATETIME fields.
  const d = iso ? new Date(iso) : new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  )
}

function combineLocalDateAndTime(dateStr, timeStr) {
  // Inputs:
  // - dateStr: "YYYY-MM-DD"
  // - timeStr: "HH:MM"
  // Output:
  // - "YYYY-MM-DD HH:MM:00"
  if (!dateStr || !timeStr) return null
  const time = String(timeStr).trim()
  const date = String(dateStr).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!/^\d{2}:\d{2}$/.test(time)) return null
  return `${date} ${time}:00`
}

function addMinutesToDateTime(dateTimeStr, minutes) {
  // dateTimeStr: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM:00"
  // This is UTC-ish for our local dev use; we keep it simple.
  if (!dateTimeStr) return null
  const iso = dateTimeStr.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCMinutes(d.getUTCMinutes() + Number(minutes))
  return toDbDateTime(d.toISOString())
}

module.exports = {
  normaliseRegistration,
  isLikelyUkRegistration,
  toOperationalUpper,
  cleanPhone,
  nowIso,
  toDbDateTime,
  combineLocalDateAndTime,
  addMinutesToDateTime,
}
