import { API_BASE_URL } from '../config/api'

async function parseJsonSafely(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

export async function apiGet(path) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, { method: 'GET', credentials: 'include' })
  const json = await parseJsonSafely(res)
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) ||
      `Request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}

export async function apiPost(path, body) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await parseJsonSafely(res)
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) ||
      `Request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}

export async function apiPatch(path, body) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await parseJsonSafely(res)
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) ||
      `Request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}

export async function apiDelete(path) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' })
  const json = await parseJsonSafely(res)
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) ||
      `Request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}
