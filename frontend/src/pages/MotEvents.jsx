import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

export default function MotEvents({ onOpenQuote }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredRows = searchQuery
    ? rows.filter((row) =>
        String(row.registration || '').toUpperCase().includes(searchQuery.toUpperCase()) ||
        String(row.make || '').toUpperCase().includes(searchQuery.toUpperCase()) ||
        String(row.model || '').toUpperCase().includes(searchQuery.toUpperCase()) ||
        String(row.supplier_name || '').toUpperCase().includes(searchQuery.toUpperCase())
      )
    : rows

  return (
    <div className="motPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">MOT Events</h2>
          <p className="pageSubtitle">Booked/in-progress MOT checks and result polling.</p>
        </div>
      </header>

      {error ? <div className="notice bad">{error}</div> : null}

      <div className="motControlsSection">
        <div className="motSearchBox">
          <span className="motSearchIcon">⚙</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MOT by REG, vehicle, or supplier…"
            className="motSearchInput"
          />
        </div>

        <select
          className="motStatusFilter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="booked">Booked</option>
          <option value="in_progress">In Progress</option>
          <option value="checking_result">Checking Result</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="retest_required">Retest Required</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {status === 'loading' ? (
        <div className="emptyState">Loading MOT events…</div>
      ) : null}

      {status === 'error' ? (
        <div className="emptyState">Error loading MOT events.</div>
      ) : null}

      {status === 'ready' ? (
        <>
          {filteredRows.length === 0 ? (
            <div className="emptyState">
              {searchQuery || filter ? 'No MOT events match your criteria.' : 'No MOT events found.'}
            </div>
          ) : (
            <div className="motTableWrap">
              <table className="motTable">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>REG</th>
                    <th>Vehicle</th>
                    <th>MOT Time</th>
                    <th>Supplier</th>
                    <th>Next Check</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const statusLower = String(row.status || '').toLowerCase()
                    const statusColor = getStatusColor(statusLower)

                    return (
                      <tr key={row.id} className="motTableRow">
                        <td>
                          <div className="motStatusCell">
                            <div className={`motStatusBadge ${statusColor}`}>
                              {getStatusIcon(statusLower)}
                            </div>
                            <span className="motStatusText">{row.status}</span>
                          </div>
                        </td>
                        <td className="motRegCell">
                          <span className="mono strong">{row.registration || '—'}</span>
                        </td>
                        <td className="motVehicleCell">
                          <span>{row.make || ''} {row.model || ''}</span>
                        </td>
                        <td className="motTimeCell">
                          {row.mot_time ? new Date(row.mot_time).toLocaleString('en-GB') : '—'}
                        </td>
                        <td className="motSupplierCell">
                          {row.supplier_name || '—'}
                        </td>
                        <td className="motCheckCell">
                          {row.next_check_at ? new Date(row.next_check_at).toLocaleString('en-GB') : '—'}
                        </td>
                        <td className="motActionsCell">
                          <div className="motActions">
                            <button
                              type="button"
                              className="miniButton"
                              onClick={() => checkNow(row.id)}
                            >
                              Check result
                            </button>
                            {statusLower === 'failed' ? (
                              <button
                                type="button"
                                className="miniButton primary"
                                onClick={() => createRepairQuote(row.id)}
                              >
                                Create quote
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}

function getStatusColor(status) {
  if (status === 'passed') return 'passed'
  if (status === 'failed') return 'failed'
  if (status === 'in_progress') return 'in_progress'
  if (status === 'booked') return 'booked'
  if (status === 'checking_result') return 'checking_result'
  if (status === 'retest_required') return 'retest_required'
  if (status === 'completed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  return 'neutral'
}

function getStatusIcon(status) {
  if (status === 'passed') return '✓'
  if (status === 'failed') return '✕'
  if (status === 'in_progress') return '→'
  if (status === 'booked') return '●'
  if (status === 'checking_result') return '◐'
  if (status === 'retest_required') return '↻'
  if (status === 'completed') return '✓'
  if (status === 'cancelled') return '✕'
  return '●'
}
