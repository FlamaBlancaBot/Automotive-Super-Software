import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

export default function MotEvents({ onOpenQuote }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const qs = filter ? `?status=${encodeURIComponent(filter)}` : ''
      const out = await apiGet(`/api/mot-events${qs}`)
      setRows(out.mot_events || [])
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load MOT events.')
    }
  }

  useEffect(() => {
    setDocumentTitle('MOT | A.S.S')
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function checkNow(id) {
    try {
      await apiPost(`/api/mot-events/${id}/check-result`, {})
      await load()
    } catch (err) {
      setError(err.message || 'Failed to check MOT result.')
    }
  }

  async function createRepairQuote(id) {
    try {
      const out = await apiPost(`/api/mot-events/${id}/create-repair-quote`, {})
      if (onOpenQuote && out?.quote_id) onOpenQuote(out.quote_id)
    } catch (err) {
      setError(err.message || 'Failed to create repair quote.')
    }
  }

  return (
    <div>
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">MOT Events</h2>
          <p className="pageSubtitle">Booked/in-progress MOT checks and result polling.</p>
        </div>
        <div className="pageHeaderActions">
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['booked', 'in_progress', 'checking_result', 'passed', 'failed', 'retest_required', 'completed', 'cancelled'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </header>
      {error ? <div className="notice bad">{error}</div> : null}
      {status === 'loading' ? <div className="emptyState">Loading MOT events…</div> : null}
      {status === 'ready' ? (
        <div className="quoteTableWrap" style={{ marginTop: 12 }}>
          <table className="quoteTable">
            <thead>
              <tr>
                <th>Status</th><th>REG</th><th>Vehicle</th><th>MOT time</th><th>Supplier</th><th>Next check</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.status}</td>
                  <td className="mono">{row.registration || '—'}</td>
                  <td>{row.make || ''} {row.model || ''}</td>
                  <td>{row.mot_time ? new Date(row.mot_time).toLocaleString('en-GB') : '—'}</td>
                  <td>{row.supplier_name || '—'}</td>
                  <td>{row.next_check_at ? new Date(row.next_check_at).toLocaleString('en-GB') : '—'}</td>
                  <td>
                    <div className="rowActions">
                      <button type="button" className="miniButton" onClick={() => checkNow(row.id)}>Check result now</button>
                      {String(row.status).toLowerCase() === 'failed' ? (
                        <button type="button" className="miniButton primary" onClick={() => createRepairQuote(row.id)}>Create repair quote</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

