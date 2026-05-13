import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-GB')
}

function motTone(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'passed') return 'good'
  if (v === 'failed') return 'bad'
  if (v === 'not_completed' || v === 'not_completed_this_year') return 'warn'
  return 'info'
}

function chipTone(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'passed' || v === 'complete') return 'chipGreen'
  if (v === 'failed') return 'chipRed'
  if (v === 'not_completed' || v === 'not_completed_this_year' || v === 'delayed') return 'chipYellow'
  if (v === 'unknown') return 'chipGrey'
  return 'chipOrange'
}

export default function MotEvents({ onOpenJob }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [actionLoading, setActionLoading] = useState({})
  const [actionMessage, setActionMessage] = useState('')
  const [manualReg, setManualReg] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualResult, setManualResult] = useState(null)

  useEffect(() => {
    setDocumentTitle('MOT')
  }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const qs = new URLSearchParams()
      if (filter) qs.set('status', filter)
      const out = await apiGet(`/api/mot/checks?${qs.toString()}`)
      setRows(out.checks || [])
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load MOT checks.')
    }
  }

  useEffect(() => { load() }, [filter])

  async function loadDetail(id) {
    try {
      const out = await apiGet(`/api/mot/checks/${id}`)
      setDetail(out)
      setSelected(id)
    } catch (err) {
      setError(err.message || 'Failed to load MOT details.')
    }
  }

  function setRowLoading(id, action, loading) {
    setActionLoading((prev) => ({ ...prev, [`${id}:${action}`]: loading }))
  }

  async function markArrived(id) {
    setRowLoading(id, 'arrived', true)
    setActionMessage('')
    try {
      const out = await apiPost(`/api/mot/checks/${id}/mark-arrived`, {})
      await load()
      if (selected === id) await loadDetail(id)
      setActionMessage(`Vehicle marked arrived/offsite. First check scheduled for ${fmtDateTime(out?.check?.next_check_at)}.`)
    } catch (err) {
      setActionMessage(`MOT action failed: ${err.message || 'Failed to mark arrived/offsite.'}`)
    } finally {
      setRowLoading(id, 'arrived', false)
    }
  }

  async function runNow(id) {
    setRowLoading(id, 'run', true)
    setActionMessage('')
    try {
      const out = await apiPost(`/api/mot/checks/${id}/run-now`, {})
      await load()
      if (selected === id) await loadDetail(id)
      const check = out?.row
      const label = check?.mot_status_label || check?.mot_status || 'Unknown'
      if (check?.mot_status === 'passed' || check?.mot_status === 'failed') {
        setActionMessage(`MOT check completed: ${label}.`)
      } else {
        setActionMessage(`MOT not completed yet. Next automatic check scheduled for ${fmtDateTime(check?.next_check_at)}.`)
      }
    } catch (err) {
      setActionMessage(`MOT check failed: ${err.message || 'Failed to run check now.'}`)
    } finally {
      setRowLoading(id, 'run', false)
    }
  }

  async function manualCheckNow() {
    if (!manualReg.trim()) return
    setManualLoading(true)
    setManualResult(null)
    try {
      const out = await apiPost('/api/mot/manual-check', { registration: manualReg.trim() })
      setManualResult(out.result || null)
    } catch (err) {
      setManualResult({ error: err.message || 'Manual check failed.' })
    } finally {
      setManualLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return rows
    return (rows || []).filter((r) => [r.registration, r.job_id, r.job_title, r.vehicle_make, r.vehicle_model].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [rows, search])

  const detailCheck = detail?.check || null
  const detailFaults = detail?.faults || []
  const dangerous = detailFaults.some((f) => f.fault_group === 'failures' && Number(f.dangerous) === 1)

  return (
    <div className="motPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">MOT Result Checks</h2>
          <p className="pageSubtitle">Live MOT polling controls and status tracking. Manual checks do not change automatic retry timing unless pass/fail completes an active MOT check.</p>
        </div>
      </header>

      {error ? <div className="notice bad">{error}</div> : null}
      {actionMessage ? <div className="notice info">{actionMessage}</div> : null}

      <div className="cardBox" style={{ marginBottom: 12 }}>
        <div className="cardTop"><h3 className="cardTitle">Quick Manual MOT Check</h3></div>
        <div className="fieldGrid" style={{ marginTop: 10 }}>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Registration</div>
            <input className="input" value={manualReg} onChange={(e) => setManualReg(e.target.value.toUpperCase())} placeholder="YA07WGK" />
          </div>
          <div className="field" style={{ gridColumn: 'span 6', display: 'flex', alignItems: 'end' }}>
            <button type="button" className="secondaryButton" disabled={manualLoading} onClick={manualCheckNow}>{manualLoading ? 'Checking MOT...' : 'Check MOT Now'}</button>
          </div>
        </div>
        {manualResult?.error ? <div className="notice bad" style={{ marginTop: 8 }}>{manualResult.error}</div> : null}
        {manualResult && !manualResult.error ? <div className={`notice ${motTone(manualResult.mot_status)}`} style={{ marginTop: 8 }}>{manualResult.mot_status_label || manualResult.mot_status || 'Unknown'}</div> : null}
      </div>

      <div className="motControlsSection">
        <div className="motSearchBox">
          <span className="motSearchIcon">MOT</span>
          <input className="motSearchInput" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registration, job id or title" />
        </div>
        <select className="motStatusFilter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="booked">booked</option>
          <option value="awaiting_result">awaiting_result</option>
          <option value="delayed">delayed</option>
          <option value="complete">complete</option>
          <option value="failed">failed</option>
        </select>
      </div>

      <div className="motTableWrap">
        <table className="motTable">
          <thead><tr><th>REG</th><th>Job</th><th>Booked</th><th>Arrived</th><th>Next auto check</th><th>Attempts</th><th>Status</th><th>Current result</th><th>Action</th></tr></thead>
          <tbody>
            {(filtered || []).map((row) => (
              <tr key={row.id} className={selected === row.id ? 'motRowSelected' : ''}>
                <td className="mono">{row.registration}</td>
                <td>#{row.job_id || '—'} {row.job_title || ''}</td>
                <td>{fmtDateTime(row.booked_start)}</td>
                <td>{row.arrived_at ? fmtDateTime(row.arrived_at) : 'Not arrived'}</td>
                <td>{fmtDateTime(row.next_check_at)}</td>
                <td>{Number(row.check_attempts || 0)}</td>
                <td><span className={`statusChip ${chipTone(row.status)}`}>{row.status}</span></td>
                <td><span className={`statusChip ${chipTone(row.mot_status)}`}>{row.mot_status_label || row.mot_status || '—'}</span></td>
                <td>
                  <div className="rowActions">
                    <button type="button" className="miniButton" onClick={() => loadDetail(row.id)}>View details</button>
                    <button type="button" className="miniButton" disabled={Boolean(actionLoading[`${row.id}:arrived`])} onClick={() => markArrived(row.id)}>{actionLoading[`${row.id}:arrived`] ? 'Marking arrived...' : 'Mark arrived/offsite'}</button>
                    <button type="button" className="miniButton primary" disabled={Boolean(actionLoading[`${row.id}:run`])} onClick={() => runNow(row.id)}>{actionLoading[`${row.id}:run`] ? 'Checking MOT...' : 'Run check now'}</button>
                    {row.job_id ? <button type="button" className="miniButton" onClick={() => onOpenJob && onOpenJob(row.job_id)}>Open job</button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status === 'loading' ? <div className="emptyState">Loading MOT checks…</div> : null}

      {detailCheck ? (
        <div className="cardBox" style={{ marginTop: 12 }}>
          <div className="cardTop"><h3 className="cardTitle">MOT Check Details: {detailCheck.registration}</h3></div>

          <div className="fieldGrid" style={{ marginTop: 10 }}>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Current booked MOT</div>
              <div className={`notice ${motTone(detailCheck.mot_status)}`}>{detailCheck.mot_status_label || detailCheck.mot_status || 'Not Completed Yet'}</div>
            </div>
            <div className="field"><div className="fieldLabel">Booked time</div><div>{fmtDateTime(detailCheck.booked_start)}</div></div>
            <div className="field"><div className="fieldLabel">Arrived/offsite</div><div>{fmtDateTime(detailCheck.arrived_at)}</div></div>
            <div className="field"><div className="fieldLabel">Automatic check status</div><div>{detailCheck.status}</div></div>
            <div className="field"><div className="fieldLabel">Next automatic check</div><div>{fmtDateTime(detailCheck.next_check_at)}</div></div>
            <div className="field"><div className="fieldLabel">Automatic attempts</div><div>{Number(detailCheck.check_attempts || 0)}</div></div>
            <div className="field"><div className="fieldLabel">Last manual check</div><div>{fmtDateTime(detailCheck.last_manual_checked_at)}</div></div>
            <div className="field"><div className="fieldLabel">Last automatic check</div><div>{fmtDateTime(detailCheck.last_checked_at)}</div></div>
          </div>

          {dangerous ? <div className="notice bad" style={{ marginTop: 10 }}>Dangerous — do not drive</div> : null}

          <div className="availabilitySummaryRow" style={{ marginTop: 10 }}>
            <span className="statusChip chipRed">Failures: {Number(detailCheck.failures_count || 0)}</span>
            <span className="statusChip chipYellow">Minors: {Number(detailCheck.minors_count || 0)}</span>
            <span className="statusChip chipGrey">Advisories: {Number(detailCheck.advisories_count || 0)}</span>
          </div>

          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Previous / last known DVSA MOT record</div>
            </div>
            <div className="field"><div className="fieldLabel">Date</div><div>{detailCheck.latest_test_date || 'No previous MOT record returned by webhook.'}</div></div>
            <div className="field"><div className="fieldLabel">Result</div><div>{detailCheck.latest_test_result || '—'}</div></div>
            <div className="field"><div className="fieldLabel">Expiry</div><div>{detailCheck.latest_test_expiry || '—'}</div></div>
          </div>

          <FaultList title="Failures" rows={detailFaults.filter((f) => f.fault_group === 'failures')} tone="bad" />
          <FaultList title="Minors" rows={detailFaults.filter((f) => f.fault_group === 'minors')} tone="warn" />
          <FaultList title="Advisories" rows={detailFaults.filter((f) => f.fault_group === 'advisories')} tone="" />
        </div>
      ) : null}
    </div>
  )
}

function FaultList({ title, rows, tone }) {
  return (
    <div style={{ marginTop: 12 }}>
      <h4 className="cardTitle">{title}</h4>
      {rows.length ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {rows.map((f) => (
            <div key={f.id} className={`notice ${Number(f.dangerous) ? 'bad' : tone}`}>
              {f.text}
              {Number(f.dangerous) ? ' (Dangerous)' : ''}
            </div>
          ))}
        </div>
      ) : <div className="emptyState">No {title.toLowerCase()}.</div>}
    </div>
  )
}
