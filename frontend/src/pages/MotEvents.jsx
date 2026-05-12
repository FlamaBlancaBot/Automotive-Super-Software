import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-GB')
}

function statusTone(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'passed') return 'chipGreen'
  if (v === 'failed') return 'chipRed'
  if (v === 'not_completed' || v === 'not_completed_this_year') return 'chipYellow'
  if (v === 'unknown') return 'chipGrey'
  return 'chipOrange'
}

export default function MotEvents({ onOpenQuote, onOpenJob }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')

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

  async function markArrived(id) {
    try {
      await apiPost(`/api/mot/checks/${id}/mark-arrived`, {})
      await load()
      if (selected === id) await loadDetail(id)
    } catch (err) {
      setError(err.message || 'Failed to mark arrived/offsite.')
    }
  }

  async function runNow(id) {
    try {
      await apiPost(`/api/mot/checks/${id}/run-now`, {})
      await load()
      if (selected === id) await loadDetail(id)
    } catch (err) {
      setError(err.message || 'Failed to run check now.')
    }
  }

  const filtered = useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return rows
    return (rows || []).filter((r) => {
      return [r.registration, r.job_id, r.job_title, r.vehicle_make, r.vehicle_model].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [rows, search])

  return (
    <div className="motPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">MOT Result Checks</h2>
          <p className="pageSubtitle">Arrival-controlled MOT polling, retries, delayed status and result faults.</p>
        </div>
      </header>

      {error ? <div className="notice bad">{error}</div> : null}

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
          <thead><tr><th>REG</th><th>Job</th><th>Booked</th><th>Arrived</th><th>Next check</th><th>Attempts</th><th>Status</th><th>Result</th><th></th></tr></thead>
          <tbody>
            {(filtered || []).map((row) => (
              <tr key={row.id} className={selected === row.id ? 'motRowSelected' : ''}>
                <td className="mono">{row.registration}</td>
                <td>#{row.job_id || '—'} {row.job_title || ''}</td>
                <td>{fmtDateTime(row.booked_start)}</td>
                <td>{row.arrived_at ? fmtDateTime(row.arrived_at) : 'Not arrived'}</td>
                <td>{fmtDateTime(row.next_check_at)}</td>
                <td>{Number(row.check_attempts || 0)}</td>
                <td><span className={`statusChip ${statusTone(row.status)}`}>{row.status}</span></td>
                <td><span className={`statusChip ${statusTone(row.mot_status)}`}>{row.mot_status_label || row.mot_status || '—'}</span></td>
                <td>
                  <div className="rowActions">
                    <button type="button" className="miniButton" onClick={() => loadDetail(row.id)}>View</button>
                    <button type="button" className="miniButton" onClick={() => markArrived(row.id)}>Mark arrived/offsite</button>
                    <button type="button" className="miniButton primary" onClick={() => runNow(row.id)}>Run check now</button>
                    {row.job_id ? <button type="button" className="miniButton" onClick={() => onOpenJob && onOpenJob(row.job_id)}>Open job</button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {status === 'loading' ? <div className="emptyState">Loading MOT checks…</div> : null}

      {detail && detail.check ? (
        <div className="cardBox" style={{ marginTop: 12 }}>
          <div className="cardTop"><h3 className="cardTitle">MOT Check Details: {detail.check.registration}</h3></div>

          <div style={{ marginTop: 10 }} className={`notice ${detail.check.mot_status === 'passed' ? 'good' : detail.check.mot_status === 'failed' ? 'bad' : detail.check.mot_status === 'not_completed_this_year' || detail.check.mot_status === 'not_completed' ? 'warn' : ''}`}>
            {detail.check.mot_status_label || detail.check.mot_status || 'No result yet'}
          </div>

          {Number(detail.check.failures_count || 0) > 0 || Number(detail.check.minors_count || 0) > 0 || Number(detail.check.advisories_count || 0) > 0 ? (
            <div className="availabilitySummaryRow" style={{ marginTop: 10 }}>
              <span className="statusChip chipRed">Failures: {Number(detail.check.failures_count || 0)}</span>
              <span className="statusChip chipYellow">Minors: {Number(detail.check.minors_count || 0)}</span>
              <span className="statusChip chipGrey">Advisories: {Number(detail.check.advisories_count || 0)}</span>
            </div>
          ) : null}

          {(detail.faults || []).some((f) => f.fault_group === 'failures' && Number(f.dangerous) === 1) ? (
            <div className="notice bad" style={{ marginTop: 10 }}>Dangerous - do not drive</div>
          ) : null}

          <div className="fieldGrid" style={{ marginTop: 10 }}>
            <div className="field"><div className="fieldLabel">Latest test date</div><div>{detail.check.latest_test_date || '—'}</div></div>
            <div className="field"><div className="fieldLabel">Latest test result</div><div>{detail.check.latest_test_result || '—'}</div></div>
            <div className="field"><div className="fieldLabel">Latest test expiry</div><div>{detail.check.latest_test_expiry || '—'}</div></div>
          </div>

          <FaultList title="Failures" rows={(detail.faults || []).filter((f) => f.fault_group === 'failures')} tone="bad" />
          <FaultList title="Minors" rows={(detail.faults || []).filter((f) => f.fault_group === 'minors')} tone="warn" />
          <FaultList title="Advisories" rows={(detail.faults || []).filter((f) => f.fault_group === 'advisories')} tone="" />
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
