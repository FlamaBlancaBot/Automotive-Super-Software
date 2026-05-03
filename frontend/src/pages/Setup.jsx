import { useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from '../config/api'
import { setDocumentTitle } from '../utils/title'

async function parseJsonSafely(response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

async function setupGet(path, token) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-Setup-Token': token },
  })
  const json = await parseJsonSafely(res)
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return json
}

async function setupPost(path, token) {
  const url = `${API_BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Setup-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const json = await parseJsonSafely(res)
  if (!res.ok) {
    const message =
      (json && (json.error || json.message)) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }
  return json
}

function formatCount(value) {
  if (value == null) return '—'
  const n = Number(value)
  return Number.isFinite(n) ? String(n) : '—'
}

export default function Setup() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setDocumentTitle('Setup')
  }, [])

  const hasToken = Boolean(String(token || '').trim())

  const tableRows = useMemo(() => {
    const tables = status && status.tables ? status.tables : null
    if (!tables) return []
    return Object.keys(tables)
      .sort()
      .map((name) => ({ name, ...tables[name] }))
  }, [status])

  async function onCheck() {
    if (!hasToken) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const data = await setupGet('/api/setup/status', token.trim())
      setStatus(data)
      setMessage('Status loaded.')
    } catch (err) {
      setError(err.message || 'Failed to check status.')
    } finally {
      setBusy(false)
    }
  }

  async function onInit() {
    if (!hasToken) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const data = await setupPost('/api/setup/init', token.trim())
      setStatus(data)
      setMessage('Init complete. Missing tables should now exist.')
    } catch (err) {
      setError(err.message || 'Failed to initialise tables.')
    } finally {
      setBusy(false)
    }
  }

  async function onSeed() {
    if (!hasToken) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const data = await setupPost('/api/setup/seed', token.trim())
      setStatus(data)
      setMessage('Seed complete (testing/demo data only).')
    } catch (err) {
      setError(err.message || 'Failed to seed data.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="setupPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Set-up</h2>
          <p className="pageSubtitle">
            Use this page when you cannot access the server terminal. It only
            creates missing tables and inserts safe demo data.
          </p>
        </div>
        <span className="setupPill" title="Admin only">
          Protected
        </span>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Setup token</h3>
          <div className="fieldHint">Token is not stored (session only).</div>
        </div>

        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">SETUP_TOKEN</div>
            <input
              className="input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter setup token"
              autoComplete="off"
            />
            <div className="fieldHint">
              The backend expects this in the request header <span className="mono">X-Setup-Token</span>.
            </div>
          </div>

          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Warning</div>
            <div className="notice warn" style={{ marginTop: 0 }}>
              Do not use reset on production. This setup page only creates missing
              tables and safe seed data.
            </div>
          </div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="secondaryButton"
            onClick={onCheck}
            disabled={!hasToken || busy}
          >
            Check database status
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={onInit}
            disabled={!hasToken || busy}
          >
            Initialise missing tables
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={onSeed}
            disabled={!hasToken || busy}
          >
            Seed demo data
          </button>
          {busy ? <span className="fieldHint">Working…</span> : null}
        </div>

        {message ? <div className="notice good">{message}</div> : null}
        {error ? <div className="notice bad">{error}</div> : null}
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Database status</h3>
          <div className="fieldHint">
            {status && status.time ? `Checked: ${status.time}` : 'Not checked yet'}
          </div>
        </div>

        {tableRows.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Exists</th>
                  <th>Count</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((t) => (
                  <tr key={t.name}>
                    <td className="mono">{t.name}</td>
                    <td>{t.exists ? 'Yes' : 'No'}</td>
                    <td>{formatCount(t.count)}</td>
                    <td className="fieldHint">
                      {t.count_error ? `Count error: ${t.count_error}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            Enter the setup token and click “Check database status”.
          </div>
        )}
      </div>
    </div>
  )
}

