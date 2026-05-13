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

function faultDefaultIncluded(f) {
  const group = String(f.fault_group || '').toLowerCase()
  if (group === 'advisories') return false
  return true
}

export default function MotEvents({ onOpenJob, onOpenQuote }) {
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

  const [quickAdd, setQuickAdd] = useState({ registration: '', booked_start: '', notes: '', manual_only: true })
  const [quickAddLoading, setQuickAddLoading] = useState('idle')

  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteFaultDrafts, setQuoteFaultDrafts] = useState([])
  const [quoteTitle, setQuoteTitle] = useState('MOT Repair Quote')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteResult, setQuoteResult] = useState(null)

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

  async function quickAddCheck(alsoRun) {
    if (!quickAdd.registration.trim()) return
    setQuickAddLoading(alsoRun ? 'adding_and_checking' : 'adding')
    setActionMessage('')
    try {
      const out = await apiPost('/api/mot/checks/quick-add', {
        registration: quickAdd.registration,
        booked_start: quickAdd.booked_start || null,
        notes: quickAdd.notes || null,
        manual_only: quickAdd.manual_only,
      })
      await load()
      setActionMessage(out.message || `${quickAdd.registration.toUpperCase()} added to MOT list.`)
      if (alsoRun && out?.check?.id) {
        const run = await apiPost('/api/mot/manual-check', { mot_result_check_id: out.check.id })
        const row = run?.row
        if (row?.mot_status === 'passed' || row?.mot_status === 'failed') {
          setActionMessage(`MOT check completed: ${row.mot_status_label || row.mot_status}.`)
        } else {
          setActionMessage(`MOT not completed yet. Automatic schedule unchanged for manual check.`)
        }
      }
      setQuickAdd({ registration: '', booked_start: '', notes: '', manual_only: true })
    } catch (err) {
      setActionMessage(`Quick add failed: ${err.message || 'Unknown error.'}`)
    } finally {
      setQuickAddLoading('idle')
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
  const hasFaults = detailFaults.length > 0 || Number(detailCheck?.failures_count || 0) > 0 || Number(detailCheck?.minors_count || 0) > 0 || Number(detailCheck?.advisories_count || 0) > 0

  function openQuoteBuilder() {
    if (!detailCheck) return
    const drafts = (detailFaults || []).map((f) => ({
      fault_id: f.id,
      include: faultDefaultIncluded(f),
      title: String(f.text || '').slice(0, 180),
      description: '',
      labour_hours: '',
      parts_cost: '',
      sell_price: '',
      dangerous: Number(f.dangerous) === 1,
      fault_group: f.fault_group,
    }))
    setQuoteTitle('MOT Repair Quote')
    setQuoteFaultDrafts(drafts)
    setQuoteResult(null)
    setQuoteModalOpen(true)
  }

  async function createQuoteFromMot() {
    if (!detailCheck) return
    setQuoteLoading(true)
    setQuoteResult(null)
    try {
      const out = await apiPost(`/api/mot/checks/${detailCheck.id}/create-quote`, {
        selected_faults: quoteFaultDrafts,
        quote_title: quoteTitle,
        job_id: detailCheck.job_id || null,
        create_job_if_missing: false,
      })
      setQuoteResult(out)
      setActionMessage(out.message || `Draft MOT repair quote created: ${out?.quote?.quote_number || 'Quote'}`)
      await loadDetail(detailCheck.id)
    } catch (err) {
      setQuoteResult({ ok: false, error: err.message || 'Failed to create quote.' })
    } finally {
      setQuoteLoading(false)
    }
  }

  function setFaultDraft(idx, patch) {
    setQuoteFaultDrafts((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

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

      <div className="cardBox" style={{ marginBottom: 12 }}>
        <div className="cardTop"><h3 className="cardTitle">Quick Add MOT Check</h3></div>
        <div className="fieldGrid" style={{ marginTop: 10 }}>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Registration</div>
            <input className="input" value={quickAdd.registration} onChange={(e) => setQuickAdd((s) => ({ ...s, registration: e.target.value.toUpperCase() }))} placeholder="YA07WGK" />
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Booked date/time (optional)</div>
            <input className="input" type="datetime-local" value={quickAdd.booked_start} onChange={(e) => setQuickAdd((s) => ({ ...s, booked_start: e.target.value }))} />
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Notes (optional)</div>
            <input className="input" value={quickAdd.notes} onChange={(e) => setQuickAdd((s) => ({ ...s, notes: e.target.value }))} />
          </div>
          <div className="field" style={{ gridColumn: 'span 12' }}>
            <label className="inlineCheck"><input type="checkbox" checked={Boolean(quickAdd.manual_only)} onChange={(e) => setQuickAdd((s) => ({ ...s, manual_only: e.target.checked }))} /><span>Manual/watch-list only — no automatic polling until marked arrived/offsite</span></label>
          </div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
          <button type="button" className="secondaryButton" disabled={quickAddLoading !== 'idle'} onClick={() => quickAddCheck(false)}>{quickAddLoading === 'adding' ? 'Adding...' : 'Add to MOT List'}</button>
          <button type="button" className="primaryButton" disabled={quickAddLoading !== 'idle'} onClick={() => quickAddCheck(true)}>{quickAddLoading === 'adding_and_checking' ? 'Adding and checking...' : 'Add and Check Now'}</button>
        </div>
      </div>

      <div className="motControlsSection">
        <div className="motSearchBox">
          <span className="motSearchIcon">MOT</span>
          <input className="motSearchInput" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registration, job id or title" />
        </div>
        <select className="motStatusFilter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="manual_watch">manual_watch</option>
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

          {hasFaults ? (
            <div className="pageHeaderActions" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
              <button type="button" className="primaryButton" onClick={openQuoteBuilder}>Create Repair Quote from MOT</button>
            </div>
          ) : null}

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

      {quoteModalOpen ? (
        <div className="modalOverlay" onClick={() => setQuoteModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <h3 className="cardTitle">MOT Repair Quote Builder</h3>
                <div className="fieldHint">Prices must be reviewed before sending to customer.</div>
              </div>
              <button type="button" className="miniButton" onClick={() => setQuoteModalOpen(false)}>Close</button>
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <div className="fieldLabel">Quote title</div>
              <input className="input" value={quoteTitle} onChange={(e) => setQuoteTitle(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 10, maxHeight: '46vh', overflow: 'auto' }}>
              {quoteFaultDrafts.map((f, idx) => (
                <div key={`${f.fault_id}-${idx}`} className="cardBox" style={{ padding: 12 }}>
                  <div className="pageHeaderActions" style={{ justifyContent: 'space-between' }}>
                    <label className="inlineCheck"><input type="checkbox" checked={Boolean(f.include)} onChange={(e) => setFaultDraft(idx, { include: e.target.checked })} /><span>Include</span></label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className={`statusChip ${chipTone(f.fault_group)}`}>{f.fault_group}</span>
                      {f.dangerous ? <span className="statusChip chipRed">dangerous</span> : null}
                    </div>
                  </div>
                  <div className="fieldGrid" style={{ marginTop: 8 }}>
                    <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Line title</div><input className="input" value={f.title} onChange={(e) => setFaultDraft(idx, { title: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Internal notes / description</div><input className="input" value={f.description} onChange={(e) => setFaultDraft(idx, { description: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Labour hours (optional)</div><input className="input" value={f.labour_hours} onChange={(e) => setFaultDraft(idx, { labour_hours: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Parts cost (optional)</div><input className="input" value={f.parts_cost} onChange={(e) => setFaultDraft(idx, { parts_cost: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Sell price (optional)</div><input className="input" value={f.sell_price} onChange={(e) => setFaultDraft(idx, { sell_price: e.target.value })} /></div>
                  </div>
                </div>
              ))}
            </div>

            {quoteResult?.ok === false ? <div className="notice bad" style={{ marginTop: 10 }}>{quoteResult.error}</div> : null}
            {quoteResult?.ok ? <div className="notice good" style={{ marginTop: 10 }}>{quoteResult.message || `Draft MOT repair quote created: ${quoteResult?.quote?.quote_number}`}</div> : null}

            <div className="pageHeaderActions" style={{ marginTop: 12, justifyContent: 'space-between' }}>
              <button type="button" className="secondaryButton" onClick={() => setQuoteModalOpen(false)}>Stay on MOT</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {quoteResult?.quote?.id ? <button type="button" className="secondaryButton" onClick={() => onOpenQuote && onOpenQuote(quoteResult.quote.id)}>Open Quote</button> : null}
                {quoteResult?.linked_job_id ? <button type="button" className="secondaryButton" onClick={() => onOpenJob && onOpenJob(quoteResult.linked_job_id)}>Open Job</button> : null}
                <button type="button" className="primaryButton" disabled={quoteLoading} onClick={createQuoteFromMot}>{quoteLoading ? 'Creating draft quote...' : 'Create Draft Quote'}</button>
              </div>
            </div>
          </div>
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
