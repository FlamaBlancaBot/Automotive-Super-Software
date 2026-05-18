import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import RegistrationPlateInput from '../components/RegistrationPlateInput'

const HIDDEN_MOT_CHECKS_KEY = 'autoss_hidden_mot_check_ids'

function getHiddenMotCheckIds() {
  try {
    const stored = localStorage.getItem(HIDDEN_MOT_CHECKS_KEY)
    return new Set(stored ? JSON.parse(stored) : [])
  } catch {
    return new Set()
  }
}

function saveHiddenMotCheckIds(ids) {
  try {
    localStorage.setItem(HIDDEN_MOT_CHECKS_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    /* Silently fail if localStorage is unavailable */
  }
}

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

const POLLING_OPTIONS = [
  { value: 0, label: 'Manual only (no auto-polling)' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 10, label: 'Every 10 minutes' },
]

export default function MotEvents({ onOpenJob, onOpenQuote }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [actionLoading, setActionLoading] = useState({})
  const [actionMessage, setActionMessage] = useState('')
  const [hiddenChecks, setHiddenChecks] = useState(() => getHiddenMotCheckIds())
  const [tab, setTab] = useState('active')

  const [manualReg, setManualReg] = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualResult, setManualResult] = useState(null)

  const [quickAdd, setQuickAdd] = useState({
    registration: '',
    booked_start: '',
    notes: '',
    polling_interval_minutes: 0,
  })
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
      const out = await apiGet(`/api/mot/checks`)
      setRows(out.checks || [])
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load MOT checks.')
    }
  }

  useEffect(() => {
    load()
  }, [])

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
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setActionMessage(`MOT action failed: ${err.message || 'Failed to mark arrived/offsite.'}${detail}`)
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
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setActionMessage(`MOT check failed: ${err.message || 'Failed to run check now.'}${detail}`)
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
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setManualResult({ error: `${err.message || 'Manual check failed.'}${detail}` })
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
        manual_only: quickAdd.polling_interval_minutes === 0,
        polling_interval_minutes: quickAdd.polling_interval_minutes,
      })
      await load()
      setActionMessage(out.message || `${quickAdd.registration.toUpperCase()} added to MOT list.`)
      if (alsoRun && out?.check?.id) {
        const run = await apiPost('/api/mot/manual-check', { mot_result_check_id: out.check.id })
        const row = run?.row
        if (row?.mot_status === 'passed' || row?.mot_status === 'failed') {
          setActionMessage(`MOT check completed: ${row.mot_status_label || row.mot_status}.`)
        } else {
          setActionMessage(`MOT not completed yet. Polling will resume on schedule.`)
        }
      }
      setQuickAdd({ registration: '', booked_start: '', notes: '', polling_interval_minutes: 0 })
    } catch (err) {
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setActionMessage(`Quick add failed: ${err.message || 'Unknown error.'}${detail}`)
    } finally {
      setQuickAddLoading('idle')
    }
  }

  function toggleHideCheck(checkId) {
    setHiddenChecks((prev) => {
      const next = new Set(prev)
      if (next.has(checkId)) {
        next.delete(checkId)
      } else {
        next.add(checkId)
      }
      saveHiddenMotCheckIds(next)
      return next
    })
  }

  function openQuoteBuilder() {
    if (!detail?.check) return
    const drafts = (detail?.faults || []).map((f) => ({
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
    if (!detail?.check) return
    setQuoteLoading(true)
    setQuoteResult(null)
    try {
      const out = await apiPost(`/api/mot/checks/${detail.check.id}/create-quote`, {
        selected_faults: quoteFaultDrafts,
        quote_title: quoteTitle,
        job_id: detail.check.job_id || null,
        create_job_if_missing: false,
      })
      setQuoteResult(out)
      setActionMessage(out.message || `Draft MOT repair quote created: ${out?.quote?.quote_number || 'Quote'}`)
      await loadDetail(detail.check.id)
    } catch (err) {
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setQuoteResult({ ok: false, error: `${err.message || 'Failed to create quote.'}${detail}` })
    } finally {
      setQuoteLoading(false)
    }
  }

  function setFaultDraft(idx, patch) {
    setQuoteFaultDrafts((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

  // Tab filtering logic
  const tabData = useMemo(() => {
    const activeRows = rows.filter((r) => {
      if (hiddenChecks.has(r.id)) return false
      const status = String(r.status || '').toLowerCase()
      const motStatus = String(r.mot_status || '').toLowerCase()
      return !['complete', 'completed'].includes(motStatus) && !['complete', 'completed'].includes(status)
    })

    const completedRows = rows.filter((r) => {
      if (hiddenChecks.has(r.id)) return false
      const motStatus = String(r.mot_status || '').toLowerCase()
      return motStatus === 'passed' || (motStatus && !['failed', 'not_completed', 'not_completed_this_year'].includes(motStatus))
    })

    const failedRows = rows.filter((r) => {
      if (hiddenChecks.has(r.id)) return false
      const motStatus = String(r.mot_status || '').toLowerCase()
      return motStatus === 'failed' || Number(r.failures_count || 0) > 0
    })

    const hiddenRows = rows.filter((r) => hiddenChecks.has(r.id))

    return { activeRows, completedRows, failedRows, hiddenRows }
  }, [rows, hiddenChecks])

  const summaryStats = useMemo(() => {
    return {
      active: tabData.activeRows.length,
      completed: tabData.completedRows.length,
      needsQuote: tabData.failedRows.length,
      hidden: tabData.hiddenRows.length,
    }
  }, [tabData])

  const detailCheck = detail?.check || null
  const detailFaults = detail?.faults || []
  const dangerous = detailFaults.some((f) => f.fault_group === 'failures' && Number(f.dangerous) === 1)
  const hasFaults = detailFaults.length > 0 || Number(detailCheck?.failures_count || 0) > 0 || Number(detailCheck?.minors_count || 0) > 0 || Number(detailCheck?.advisories_count || 0) > 0

  const tabRows = {
    active: tabData.activeRows,
    completed: tabData.completedRows,
    failed: tabData.failedRows,
    hidden: tabData.hiddenRows,
    all: rows.filter((r) => !hiddenChecks.has(r.id)),
  }

  const currentTabRows = tabRows[tab] || []

  return (
    <div className="motPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">MOT Result Checks</h2>
          <p className="pageSubtitle">Track MOT polling, view results, and build repair quotes.</p>
        </div>
      </header>

      {error && <div className="notice bad">{error}</div>}
      {actionMessage && <div className="notice info">{actionMessage}</div>}

      {/* Summary Cards */}
      <div className="motSummaryCards">
        <div className="motSummaryCard">
          <div className="motSummaryValue">{summaryStats.active}</div>
          <div className="motSummaryLabel">Active</div>
        </div>
        <div className="motSummaryCard">
          <div className="motSummaryValue">{summaryStats.completed}</div>
          <div className="motSummaryLabel">Completed</div>
        </div>
        <div className="motSummaryCard">
          <div className="motSummaryValue">{summaryStats.needsQuote}</div>
          <div className="motSummaryLabel">Needs Quote</div>
        </div>
        <div className="motSummaryCard">
          <div className="motSummaryValue">{summaryStats.hidden}</div>
          <div className="motSummaryLabel">Hidden</div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="motQuickActionsRow">
        {/* Quick Manual Check */}
        <div className="cardBox motQuickCard">
          <div className="cardTop">
            <h3 className="cardTitle">🔍 Quick Manual Check</h3>
          </div>
          <p className="fieldHint" style={{ marginTop: 8 }}>Check a vehicle's current MOT status from DVSA.</p>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Registration</div>
              <RegistrationPlateInput
                value={manualReg}
                onChange={setManualReg}
                placeholder="AB07 XYZ"
              />
            </div>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <button
                type="button"
                className="primaryButton"
                disabled={manualLoading || !manualReg.trim()}
                onClick={manualCheckNow}
                style={{ width: '100%' }}
              >
                {manualLoading ? 'Checking MOT...' : 'Check MOT Now'}
              </button>
            </div>
          </div>
          {manualResult?.error && <div className="notice bad" style={{ marginTop: 12 }}>{manualResult.error}</div>}
          {manualResult && !manualResult.error && (
            <div className={`notice ${motTone(manualResult.mot_status)}`} style={{ marginTop: 12 }}>
              <strong>{manualResult.mot_status_label || manualResult.mot_status || 'Unknown'}</strong>
            </div>
          )}
        </div>

        {/* Quick Add to Watch */}
        <div className="cardBox motQuickCard">
          <div className="cardTop">
            <h3 className="cardTitle">➕ Add to MOT Watch</h3>
          </div>
          <p className="fieldHint" style={{ marginTop: 8 }}>Add a vehicle to the watch list and set polling frequency.</p>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Registration <span style={{ color: 'var(--error, #ef4444)' }}>*</span></div>
              <RegistrationPlateInput
                value={quickAdd.registration}
                onChange={(v) => setQuickAdd((s) => ({ ...s, registration: v }))}
                placeholder="AB07 XYZ"
              />
            </div>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Polling frequency</div>
              <select
                className="select"
                value={quickAdd.polling_interval_minutes}
                onChange={(e) => setQuickAdd((s) => ({ ...s, polling_interval_minutes: Number(e.target.value) }))}
              >
                {POLLING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="fieldHint" style={{ marginTop: 4 }}>Automatically re-check until result is found.</div>
            </div>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Booked date/time (optional)</div>
              <input
                type="datetime-local"
                className="input"
                value={quickAdd.booked_start}
                onChange={(e) => setQuickAdd((s) => ({ ...s, booked_start: e.target.value }))}
              />
            </div>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Notes (optional)</div>
              <input
                type="text"
                className="input"
                value={quickAdd.notes}
                onChange={(e) => setQuickAdd((s) => ({ ...s, notes: e.target.value }))}
                placeholder="e.g. Customer phoned, pending renewal"
              />
            </div>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="pageHeaderActions" style={{ gap: 8, justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="secondaryButton"
                  disabled={quickAddLoading !== 'idle' || !quickAdd.registration.trim()}
                  onClick={() => quickAddCheck(false)}
                >
                  {quickAddLoading === 'adding' ? 'Adding...' : 'Add to List'}
                </button>
                <button
                  type="button"
                  className="primaryButton"
                  disabled={quickAddLoading !== 'idle' || !quickAdd.registration.trim()}
                  onClick={() => quickAddCheck(true)}
                >
                  {quickAddLoading === 'adding_and_checking' ? 'Adding & checking...' : 'Add & Check Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Results */}
      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="motTabs">
          {[
            { key: 'active', label: `Active (${summaryStats.active})` },
            { key: 'completed', label: `Completed (${summaryStats.completed})` },
            { key: 'failed', label: `Needs Quote (${summaryStats.needsQuote})` },
            { key: 'hidden', label: `Hidden (${summaryStats.hidden})`, hidden: summaryStats.hidden === 0 },
          ]
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                className={`motTabButton ${tab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
        </div>

        {status === 'loading' && <div className="emptyState" style={{ marginTop: 12, padding: '40px' }}>Loading MOT checks…</div>}

        {status === 'ready' && currentTabRows.length === 0 && (
          <div className="emptyState" style={{ marginTop: 12, padding: '40px' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No MOT checks</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>
              {tab === 'active' && 'Add a vehicle to the watch list to get started.'}
              {tab === 'completed' && 'No completed MOT results yet.'}
              {tab === 'failed' && 'No failed MOT results.'}
              {tab === 'hidden' && 'You haven\'t hidden any MOT results.'}
            </div>
          </div>
        )}

        {status === 'ready' && currentTabRows.length > 0 && (
          <div className="motResultsList" style={{ marginTop: 12 }}>
            {currentTabRows.map((row) => (
              <div key={row.id} className="motResultCard">
                <div className="motResultCardHeader">
                  <div className="motResultReg">
                    <div className="motResultRegPlate">{row.registration}</div>
                  </div>
                  <div className="motResultInfo">
                    <div className="motResultJob">
                      {row.job_id && <span className="motResultJobId">#{row.job_id}</span>}
                      <span>{row.job_title || 'No job'}</span>
                    </div>
                    <div className="motResultVehicle">
                      {row.vehicle_make && row.vehicle_model ? `${row.vehicle_make} ${row.vehicle_model}` : 'Vehicle details'}
                    </div>
                  </div>
                  <div className="motResultStatus">
                    <span className={`statusChip ${chipTone(row.mot_status)}`}>
                      {row.mot_status_label || row.mot_status || '—'}
                    </span>
                  </div>
                </div>

                <div className="motResultDetails">
                  <div className="motResultDetail">
                    <div className="motResultDetailLabel">Booked</div>
                    <div className="motResultDetailValue">{fmtDateTime(row.booked_start)}</div>
                  </div>
                  <div className="motResultDetail">
                    <div className="motResultDetailLabel">Arrived</div>
                    <div className="motResultDetailValue">{row.arrived_at ? fmtDateTime(row.arrived_at) : 'Not arrived'}</div>
                  </div>
                  <div className="motResultDetail">
                    <div className="motResultDetailLabel">Polling</div>
                    <div className="motResultDetailValue">
                      {row.polling_interval_minutes === 0 ? 'Manual' : `${row.polling_interval_minutes}min`}
                    </div>
                  </div>
                  <div className="motResultDetail">
                    <div className="motResultDetailLabel">Attempts</div>
                    <div className="motResultDetailValue">{Number(row.check_attempts || 0)}</div>
                  </div>
                </div>

                <div className="motResultActions">
                  <button type="button" className="miniButton" onClick={() => loadDetail(row.id)}>
                    View details
                  </button>
                  <button
                    type="button"
                    className="miniButton"
                    disabled={Boolean(actionLoading[`${row.id}:arrived`])}
                    onClick={() => markArrived(row.id)}
                  >
                    {actionLoading[`${row.id}:arrived`] ? 'Marking...' : 'Mark arrived/offsite'}
                  </button>
                  <button
                    type="button"
                    className="miniButton primary"
                    disabled={Boolean(actionLoading[`${row.id}:run`])}
                    onClick={() => runNow(row.id)}
                  >
                    {actionLoading[`${row.id}:run`] ? 'Checking...' : 'Run check now'}
                  </button>
                  {row.job_id && (
                    <button type="button" className="miniButton" onClick={() => onOpenJob && onOpenJob(row.job_id)}>
                      Open job
                    </button>
                  )}
                  <button
                    type="button"
                    className="miniButton"
                    onClick={() => toggleHideCheck(row.id)}
                    title={hiddenChecks.has(row.id) ? 'Restore' : 'Hide from view'}
                  >
                    {hiddenChecks.has(row.id) ? '👁️ Show' : '👁️‍🗨️ Hide'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Section */}
      {detailCheck && (
        <div className="cardBox motDetailSection" style={{ marginTop: 12 }}>
          <div className="cardTop">
            <h3 className="cardTitle">📋 MOT Check Details</h3>
          </div>

          <div className="motDetailHeader">
            <div className="motDetailRegPlate">{detailCheck.registration}</div>
            <div className="motDetailHeaderInfo">
              <div><strong>{detailCheck.mot_status_label || detailCheck.mot_status || 'Not Completed Yet'}</strong></div>
              {detailCheck.job_id && <div>Job #{detailCheck.job_id}: {detailCheck.job_title || ''}</div>}
            </div>
          </div>

          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field"><div className="fieldLabel">Booked</div><div>{fmtDateTime(detailCheck.booked_start)}</div></div>
            <div className="field"><div className="fieldLabel">Arrived/offsite</div><div>{fmtDateTime(detailCheck.arrived_at)}</div></div>
            <div className="field"><div className="fieldLabel">Status</div><div>{detailCheck.status}</div></div>
            <div className="field"><div className="fieldLabel">Polling interval</div><div>{detailCheck.polling_interval_minutes === 0 ? 'Manual' : `${detailCheck.polling_interval_minutes} minutes`}</div></div>
            <div className="field"><div className="fieldLabel">Next check</div><div>{fmtDateTime(detailCheck.next_check_at)}</div></div>
            <div className="field"><div className="fieldLabel">Attempts</div><div>{Number(detailCheck.check_attempts || 0)}</div></div>
            <div className="field"><div className="fieldLabel">Last manual check</div><div>{fmtDateTime(detailCheck.last_manual_checked_at)}</div></div>
            <div className="field"><div className="fieldLabel">Last automatic check</div><div>{fmtDateTime(detailCheck.last_checked_at)}</div></div>
          </div>

          {dangerous && <div className="notice bad" style={{ marginTop: 12 }}>⚠️ Dangerous — do not drive</div>}

          <div className="motFaultSummary" style={{ marginTop: 12 }}>
            <span className="statusChip chipRed">Failures: {Number(detailCheck.failures_count || 0)}</span>
            <span className="statusChip chipYellow">Minors: {Number(detailCheck.minors_count || 0)}</span>
            <span className="statusChip chipGrey">Advisories: {Number(detailCheck.advisories_count || 0)}</span>
          </div>

          {hasFaults && (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="primaryButton" onClick={openQuoteBuilder}>
                Create Repair Quote from MOT
              </button>
            </div>
          )}

          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Previous / last known DVSA MOT record</div>
            </div>
            <div className="field"><div className="fieldLabel">Date</div><div>{detailCheck.latest_test_date || 'No previous MOT record.'}</div></div>
            <div className="field"><div className="fieldLabel">Result</div><div>{detailCheck.latest_test_result || '—'}</div></div>
            <div className="field"><div className="fieldLabel">Expiry</div><div>{detailCheck.latest_test_expiry || '—'}</div></div>
          </div>

          <FaultList title="Failures" rows={detailFaults.filter((f) => f.fault_group === 'failures')} tone="bad" />
          <FaultList title="Minors" rows={detailFaults.filter((f) => f.fault_group === 'minors')} tone="warn" />
          <FaultList title="Advisories" rows={detailFaults.filter((f) => f.fault_group === 'advisories')} tone="" />
        </div>
      )}

      {/* Quote Modal */}
      {quoteModalOpen && (
        <div className="modalOverlay" onClick={() => setQuoteModalOpen(false)}>
          <div className="motQuoteModal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <h3 className="cardTitle">📋 MOT Repair Quote Builder</h3>
                <div className="fieldHint">Select faults to include, then create a draft quote for review.</div>
              </div>
              <button type="button" className="miniButton" onClick={() => setQuoteModalOpen(false)}>✕</button>
            </div>

            <div className="field" style={{ marginTop: 12 }}>
              <div className="fieldLabel">Quote title</div>
              <input
                className="input"
                value={quoteTitle}
                onChange={(e) => setQuoteTitle(e.target.value)}
              />
            </div>

            <div className="motQuoteBuilderFaults" style={{ marginTop: 12 }}>
              {quoteFaultDrafts.map((f, idx) => (
                <div key={`${f.fault_id}-${idx}`} className="motQuoteBuilderFault">
                  <div className="motQuoteBuilderFaultHeader">
                    <label className="inlineCheck">
                      <input type="checkbox" checked={Boolean(f.include)} onChange={(e) => setFaultDraft(idx, { include: e.target.checked })} />
                      <span>Include</span>
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className={`statusChip ${chipTone(f.fault_group)}`}>{f.fault_group}</span>
                      {f.dangerous && <span className="statusChip chipRed">dangerous</span>}
                    </div>
                  </div>
                  <div className="fieldGrid" style={{ marginTop: 8 }}>
                    <div className="field" style={{ gridColumn: 'span 12' }}>
                      <div className="fieldLabel">Line title</div>
                      <input
                        className="input"
                        value={f.title}
                        onChange={(e) => setFaultDraft(idx, { title: e.target.value })}
                      />
                    </div>
                    <div className="field" style={{ gridColumn: 'span 12' }}>
                      <div className="fieldLabel">Internal notes</div>
                      <textarea
                        className="textarea"
                        value={f.description}
                        onChange={(e) => setFaultDraft(idx, { description: e.target.value })}
                        rows="2"
                      />
                    </div>
                    <div className="field" style={{ gridColumn: 'span 6' }}>
                      <div className="fieldLabel">Labour hours</div>
                      <input
                        type="number"
                        className="input"
                        value={f.labour_hours}
                        onChange={(e) => setFaultDraft(idx, { labour_hours: e.target.value })}
                        placeholder="1.5"
                      />
                    </div>
                    <div className="field" style={{ gridColumn: 'span 6' }}>
                      <div className="fieldLabel">Parts cost (£)</div>
                      <input
                        type="number"
                        className="input"
                        value={f.parts_cost}
                        onChange={(e) => setFaultDraft(idx, { parts_cost: e.target.value })}
                        placeholder="50.00"
                      />
                    </div>
                    <div className="field" style={{ gridColumn: 'span 6' }}>
                      <div className="fieldLabel">Sell price (£)</div>
                      <input
                        type="number"
                        className="input"
                        value={f.sell_price}
                        onChange={(e) => setFaultDraft(idx, { sell_price: e.target.value })}
                        placeholder="150.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {quoteResult?.ok === false && <div className="notice bad" style={{ marginTop: 12 }}>{quoteResult.error}</div>}
            {quoteResult?.ok && <div className="notice good" style={{ marginTop: 12 }}>{quoteResult.message || `Draft MOT repair quote created: ${quoteResult?.quote?.quote_number}`}</div>}

            <div className="pageHeaderActions" style={{ marginTop: 12, justifyContent: 'space-between' }}>
              <button type="button" className="secondaryButton" onClick={() => setQuoteModalOpen(false)}>
                Stay on MOT
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {quoteResult?.quote?.id && (
                  <button type="button" className="secondaryButton" onClick={() => onOpenQuote && onOpenQuote(quoteResult.quote.id)}>
                    Open Quote
                  </button>
                )}
                {quoteResult?.linked_job_id && (
                  <button type="button" className="secondaryButton" onClick={() => onOpenJob && onOpenJob(quoteResult.linked_job_id)}>
                    Open Job
                  </button>
                )}
                <button
                  type="button"
                  className="primaryButton"
                  disabled={quoteLoading}
                  onClick={createQuoteFromMot}
                >
                  {quoteLoading ? 'Creating quote...' : 'Create Draft Quote'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FaultList({ title, rows, tone }) {
  if (!rows || rows.length === 0) {
    return null
  }

  return (
    <div style={{ marginTop: 12 }}>
      <h4 className="cardTitle">{title} <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}>({rows.length})</span></h4>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {rows.map((f) => (
          <div key={f.id} className={`notice ${Number(f.dangerous) ? 'bad' : tone}`} style={{ wordBreak: 'break-word' }}>
            {f.text}
            {Number(f.dangerous) && <span style={{ marginLeft: 8, fontWeight: 600 }}>(⚠️ Dangerous)</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
