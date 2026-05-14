import { useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { partsOrderTone } from '../utils/statusChips'
import VehicleHeader from '../components/VehicleHeader'
import StatusChip from '../components/StatusChip'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

export default function JobDetail({ jobId, onBackToJobs, onOpenQuote, onViewPartsOrders, onOpenJobSheet, onOpenInvoice, onOpenCommunications }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [job, setJob] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [partsOrders, setPartsOrders] = useState([])
  const [motCheck, setMotCheck] = useState(null)
  const [motFaults, setMotFaults] = useState([])
  const [inventoryUsage, setInventoryUsage] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryDraft, setInventoryDraft] = useState({ inventory_item_id: '', quantity: '', notes: '' })
  const [jobSheet, setJobSheet] = useState(null)
  const [jobActivity, setJobActivity] = useState([])
  const [jobCommunications, setJobCommunications] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [assignments, setAssignments] = useState([])
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showBayModal, setShowBayModal] = useState(false)
  const [assignDraft, setAssignDraft] = useState({ technician_id: '', assignment_role: '', estimated_hours: '', status: 'assigned' })
  const [activityDraft, setActivityDraft] = useState({ technician_id: '', event_type: 'internal_note', title: '', description: '' })
  const [bays, setBays] = useState([])
  const [currentBayAssignment, setCurrentBayAssignment] = useState(null)
  const [bayDraft, setBayDraft] = useState({ bay_id: '', notes: '' })
  const [invoices, setInvoices] = useState([])
  const [actionStatus, setActionStatus] = useState('idle')
  const [suggestionsStatus, setSuggestionsStatus] = useState('idle')
  const [suggestionsError, setSuggestionsError] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [vehicleHistoryOverview, setVehicleHistoryOverview] = useState(null)
  const [motActionStatus, setMotActionStatus] = useState('idle')
  const [motActionMessage, setMotActionMessage] = useState('')
  const [motQuoteOpen, setMotQuoteOpen] = useState(false)
  const [motQuoteDrafts, setMotQuoteDrafts] = useState([])
  const [motQuoteLoading, setMotQuoteLoading] = useState(false)
  const [motQuoteResult, setMotQuoteResult] = useState(null)

  useEffect(() => {
    setDocumentTitle('Jobs')
  }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet(`/api/jobs/${jobId}`)
      setJob(data.job || null)
      setQuotes(data.quotes || [])
      setPartsOrders(data.parts_orders || [])
      setMotCheck(data.mot_check || null)
      setMotFaults(data.mot_faults || [])
      setInventoryUsage(data.inventory_usage || [])
      const invoiceRes = await apiGet(`/api/jobs/${jobId}/invoices`).catch(() => ({ invoices: [] }))
      setInvoices(invoiceRes.invoices || [])
      const [sheetRes, techRes, assignmentsRes, jobActivityRes, baysRes, jobBayRes, commsRes] = await Promise.all([
        apiGet(`/api/jobs/${jobId}/job-sheet`).catch(() => null),
        apiGet('/api/technicians').catch(() => ({ technicians: [] })),
        apiGet(`/api/jobs/${jobId}/technicians`).catch(() => ({ assignments: [] })),
        apiGet(`/api/jobs/${jobId}/activity`).catch(() => ({ events: [] })),
        apiGet('/api/bays').catch(() => ({ bays: [] })),
        apiGet(`/api/jobs/${jobId}/bay`).catch(() => ({ current_assignment: null })),
        apiGet(`/api/communications/messages?job_id=${encodeURIComponent(jobId)}`).catch(() => ({ messages: [] })),
      ])
      setJobSheet(sheetRes || null)
      setTechnicians((techRes && techRes.technicians) || [])
      setAssignments((assignmentsRes && assignmentsRes.assignments) || [])
      setJobActivity((jobActivityRes && jobActivityRes.events) || [])
      setBays((baysRes && baysRes.bays) || [])
      setCurrentBayAssignment((jobBayRes && jobBayRes.current_assignment) || null)
      setJobCommunications((commsRes && commsRes.messages) || [])
      const invItems = await apiGet('/api/inventory/items?active=true').catch(() => ({ items: [] }))
      setInventoryItems(invItems.items || [])
      const regNorm = String((data.job && data.job.vehicle_registration) || '').toUpperCase().replace(/\s+/g, '').trim()
      if (regNorm) {
        const history = await apiGet(`/api/vehicles/${encodeURIComponent(regNorm)}/overview`).catch(() => null)
        setVehicleHistoryOverview(history || null)
      } else {
        setVehicleHistoryOverview(null)
      }
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load job.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  useEffect(() => {
    if (!job) return
    const reg = job.vehicle_registration || 'REG'
    setDocumentTitle(`Job ${job.id} - ${reg}`)
  }, [job])

  useEffect(() => {
    if (!job) return
    refreshSuggestions(job)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.booked_start, job?.booked_end, job?.estimated_duration_minutes, job?.service_template_name])

  async function createOrOpenQuote() {
    if (!job) return
    setActionStatus('saving')
    try {
      const data = await apiPost(`/api/jobs/${job.id}/quotes`, {})
      if (data && data.quote && data.quote.id) onOpenQuote(data.quote.id)
    } finally {
      setActionStatus('idle')
    }
  }

  async function createOrOpenInvoice() {
    if (!job) return
    setActionStatus('saving')
    try {
      const out = await apiPost(`/api/jobs/${job.id}/invoice`, {})
      if (out && out.invoice) {
        if (typeof onOpenInvoice === 'function') {
          onOpenInvoice(out.invoice.id)
        } else {
          await load()
        }
      }
    } finally {
      setActionStatus('idle')
    }
  }

  async function refreshAssignmentsAndActivity() {
    const [assignmentsRes, jobActivityRes, jobBayRes, commsRes] = await Promise.all([
      apiGet(`/api/jobs/${jobId}/technicians`).catch(() => ({ assignments: [] })),
      apiGet(`/api/jobs/${jobId}/activity`).catch(() => ({ events: [] })),
      apiGet(`/api/jobs/${jobId}/bay`).catch(() => ({ current_assignment: null })),
      apiGet(`/api/communications/messages?job_id=${encodeURIComponent(jobId)}`).catch(() => ({ messages: [] })),
    ])
    setAssignments(assignmentsRes.assignments || [])
    setJobActivity(jobActivityRes.events || [])
    setCurrentBayAssignment(jobBayRes.current_assignment || null)
    setJobCommunications(commsRes.messages || [])
  }

  async function recordInventoryUsage() {
    if (!inventoryDraft.inventory_item_id || !inventoryDraft.quantity) return
    await apiPost(`/api/jobs/${jobId}/inventory-usage`, {
      inventory_item_id: Number(inventoryDraft.inventory_item_id),
      quantity: Number(inventoryDraft.quantity),
      notes: inventoryDraft.notes || null,
      reference: `JOB-${jobId}`,
    })
    setInventoryDraft({ inventory_item_id: '', quantity: '', notes: '' })
    await load()
  }

  async function markMotArrived() {
    if (!job) return
    setMotActionStatus('arrived')
    setMotActionMessage('')
    try {
      const out = await apiPost(`/api/jobs/${job.id}/mot/mark-arrived`, {})
      await load()
      setMotActionMessage(`Vehicle marked arrived/offsite. First check scheduled for ${formatDateTime(out?.check?.next_check_at)}.`)
    } catch (err) {
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setMotActionMessage(`MOT action failed: ${err.message || 'Failed to mark arrived/offsite.'}${detail}`)
    } finally {
      setMotActionStatus('idle')
    }
  }

  async function runMotNow() {
    if (!motCheck) return
    setMotActionStatus('run')
    setMotActionMessage('')
    try {
      const out = await apiPost(`/api/mot/checks/${motCheck.id}/run-now`, {})
      await load()
      const label = out?.row?.mot_status_label || out?.row?.mot_status || 'Unknown'
      if (out?.row?.mot_status === 'passed' || out?.row?.mot_status === 'failed') {
        setMotActionMessage(`MOT check completed: ${label}.`)
      } else {
        setMotActionMessage(`MOT not completed yet. Next automatic check scheduled for ${formatDateTime(out?.row?.next_check_at)}.`)
      }
    } catch (err) {
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setMotActionMessage(`MOT check failed: ${err.message || 'Failed to run check now.'}${detail}`)
    } finally {
      setMotActionStatus('idle')
    }
  }

  async function createMotCheckForJob() {
    if (!job) return
    setMotActionStatus('creating')
    setMotActionMessage('')
    try {
      const out = await apiPost('/api/mot/checks', {
        job_id: job.id,
        vehicle_id: job.vehicle_id,
        registration: job.vehicle_registration,
        booked_start: job.booked_start || null,
      })
      await load()
      if (out?.check?.id) setMotActionMessage(`MOT check created for ${out.check.registration}. Mark arrived/offsite to start automated polling.`)
    } catch (err) {
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setMotActionMessage(`Failed to create MOT check: ${err.message || 'Unknown error.'}${detail}`)
    } finally {
      setMotActionStatus('idle')
    }
  }

  function openMotQuoteBuilder() {
    const drafts = (motFaults || []).map((f) => ({
      fault_id: f.id,
      include: String(f.fault_group || '').toLowerCase() !== 'advisories',
      title: String(f.text || '').slice(0, 180),
      description: '',
      labour_hours: '',
      parts_cost: '',
      sell_price: '',
      fault_group: f.fault_group,
      dangerous: Number(f.dangerous) === 1,
    }))
    setMotQuoteDrafts(drafts)
    setMotQuoteResult(null)
    setMotQuoteOpen(true)
  }

  function setMotQuoteDraft(idx, patch) {
    setMotQuoteDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, ...patch } : x)))
  }

  async function createMotQuote() {
    if (!motCheck) return
    setMotQuoteLoading(true)
    setMotQuoteResult(null)
    try {
      const out = await apiPost(`/api/mot/checks/${motCheck.id}/create-quote`, {
        selected_faults: motQuoteDrafts,
        quote_title: 'MOT Repair Quote',
        job_id: job.id,
        create_job_if_missing: false,
      })
      setMotQuoteResult(out)
      setMotActionMessage(out.message || `Draft MOT repair quote created: ${out?.quote?.quote_number || 'Quote'}`)
      await load()
    } catch (err) {
      const detail = err?.payload?.details ? ` (${err.payload.details})` : ''
      setMotQuoteResult({ ok: false, error: `${err.message || 'Failed to create MOT quote.'}${detail}` })
    } finally {
      setMotQuoteLoading(false)
    }
  }

  function resolveSuggestionInputs(sourceJob) {
    if (!sourceJob) return null
    const startSource = sourceJob.booked_start || (sourceJob.requested_date ? `${sourceJob.requested_date} 09:00:00` : null)
    if (!startSource) return null
    const startDate = new Date(String(startSource).replace(' ', 'T'))
    if (Number.isNaN(startDate.getTime())) return null
    const date = startDate.toISOString().slice(0, 10)
    const hh = String(startDate.getHours()).padStart(2, '0')
    const mm = String(startDate.getMinutes()).padStart(2, '0')
    const time = `${hh}:${mm}`
    const duration = Math.max(15, Number(sourceJob.estimated_duration_minutes || 60))
    const serviceTitle = sourceJob.service_template_name || sourceJob.title || ''
    const requiresMotBay = Number(sourceJob.service_is_mot || 0) === 1 || String(serviceTitle).toLowerCase().includes('mot')
    return { date, time, duration, serviceTitle, requiresMotBay }
  }

  async function refreshSuggestions(sourceJob = job) {
    const inputs = resolveSuggestionInputs(sourceJob)
    if (!inputs) {
      setSuggestionsStatus('error')
      setSuggestionsError('No booking date/time available for this job yet.')
      setSuggestions(null)
      return
    }
    setSuggestionsStatus('loading')
    setSuggestionsError('')
    try {
      const qs = new URLSearchParams({
        date: inputs.date,
        time: inputs.time,
        duration_minutes: String(inputs.duration),
        service_title: String(inputs.serviceTitle || ''),
        requires_mot_bay: inputs.requiresMotBay ? 'true' : 'false',
        job_id: String(jobId),
      })
      const data = await apiGet(`/api/availability/suggest?${qs.toString()}`)
      setSuggestions(data)
      setSuggestionsStatus('ready')
    } catch (err) {
      setSuggestionsStatus('error')
      setSuggestionsError(err.message || 'Failed to load scheduling suggestions.')
    }
  }

  async function assignBay() {
    if (!bayDraft.bay_id) return
    await apiPost(`/api/jobs/${jobId}/bay`, { bay_id: Number(bayDraft.bay_id), notes: bayDraft.notes || null })
    setShowBayModal(false)
    setBayDraft({ bay_id: '', notes: '' })
    await refreshAssignmentsAndActivity()
  }

  async function releaseBay() {
    if (!currentBayAssignment) return
    await apiDelete(`/api/jobs/${jobId}/bay/${currentBayAssignment.id}`)
    await refreshAssignmentsAndActivity()
  }

  async function addAssignment() {
    if (!assignDraft.technician_id) return
    await apiPost(`/api/jobs/${jobId}/technicians`, {
      technician_id: Number(assignDraft.technician_id),
      assignment_role: assignDraft.assignment_role || null,
      estimated_hours: assignDraft.estimated_hours === '' ? null : Number(assignDraft.estimated_hours),
      status: assignDraft.status || 'assigned',
    })
    setShowAssignModal(false)
    setAssignDraft({ technician_id: '', assignment_role: '', estimated_hours: '', status: 'assigned' })
    await refreshAssignmentsAndActivity()
  }

  async function updateAssignment(assignment, patch) {
    await apiPatch(`/api/jobs/${jobId}/technicians/${assignment.id}`, patch)
    await refreshAssignmentsAndActivity()
  }

  async function removeAssignment(assignment) {
    await apiDelete(`/api/jobs/${jobId}/technicians/${assignment.id}`)
    await refreshAssignmentsAndActivity()
  }

  async function addActivityEvent() {
    if (!activityDraft.event_type || !activityDraft.title.trim()) return
    await apiPost(`/api/jobs/${jobId}/activity`, {
      technician_id: activityDraft.technician_id ? Number(activityDraft.technician_id) : null,
      event_type: activityDraft.event_type,
      title: activityDraft.title.trim(),
      description: activityDraft.description.trim() || null,
    })
    setShowActivityModal(false)
    setActivityDraft({ technician_id: '', event_type: 'internal_note', title: '', description: '' })
    await refreshAssignmentsAndActivity()
  }

  if (status === 'loading') {
    return (
      <div className="jobsPage">
        <div className="emptyState">Loading…</div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="jobsPage">
        <div className="emptyState">{error}</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="jobsPage">
        <div className="emptyState">Job not found.</div>
      </div>
    )
  }

  return (
    <div className="jobsPage">
      <header className="jobDetailHeader">
        <button type="button" className="headerBackBtn" onClick={onBackToJobs}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="jobDetailHeaderContent">
          <h1 className="jobDetailTitle">Job {job.id}</h1>
          <p className="jobDetailSubtitle">{job.title || job.service_template_name}</p>
        </div>
        <button
          type="button"
          className="primaryButton"
          onClick={createOrOpenQuote}
          disabled={actionStatus === 'saving'}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          {actionStatus === 'saving' ? 'Working…' : 'Create Quote'}
        </button>
      </header>

      <div className="jobDetailGrid">
        <div className="jobDetailMain">
          <div className="jobDetailCard">
            <h2 className="jobDetailCardTitle">Job Information</h2>
            <div className="jobDetailInfoGrid">
              <div className="jobDetailInfoField">
                <div className="jobDetailLabel">Status</div>
                <StatusChip label={job.status} tone="chipGrey" />
              </div>
              <div className="jobDetailInfoField">
                <div className="jobDetailLabel">Priority</div>
                <div className="jobDetailValue">{job.priority || '—'}</div>
              </div>
              <div className="jobDetailInfoField">
                <div className="jobDetailLabel">Customer</div>
                <div className="jobDetailValue">{job.customer_first_name} {job.customer_surname}</div>
              </div>
              <div className="jobDetailInfoField">
                <div className="jobDetailLabel">Vehicle</div>
                <div className="jobDetailValue">{job.vehicle_make} {job.vehicle_model}</div>
              </div>
              <div className="jobDetailInfoField">
                <div className="jobDetailLabel">REG</div>
                <div className="jobDetailValue mono">{job.vehicle_registration || 'Registration missing - check linked vehicle/job'}</div>
              </div>
              <div className="jobDetailInfoField">
                <div className="jobDetailLabel">Phone</div>
                <div className="jobDetailValue mono">{job.customer_phone || '—'}</div>
              </div>
            </div>
          </div>

          {Number(job.service_is_mot || 0) === 1 || motCheck ? (
          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="jobDetailCardTitle">Workshop Bay</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="secondaryButton" onClick={() => setShowBayModal(true)}>
                  {currentBayAssignment ? 'Change Bay' : 'Assign Bay'}
                </button>
                {currentBayAssignment ? <button type="button" className="secondaryButton" onClick={releaseBay}>Release</button> : null}
              </div>
            </div>
            {currentBayAssignment ? (
              <div className="fieldGrid">
                <div className="field"><div className="fieldLabel">Current bay</div><div>{currentBayAssignment.bay_name}</div></div>
                <div className="field"><div className="fieldLabel">Bay type</div><div>{currentBayAssignment.bay_type || '—'}</div></div>
                <div className="field"><div className="fieldLabel">MOT bay</div><div>{Number(currentBayAssignment.is_mot_bay) ? 'YES' : 'NO'}</div></div>
                <div className="field"><div className="fieldLabel">Assigned at</div><div>{formatDateTime(currentBayAssignment.assigned_at)}</div></div>
                <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Notes</div><div>{currentBayAssignment.notes || '—'}</div></div>
              </div>
            ) : <div className="emptyState">No bay assigned yet.</div>}
          </div>
          ) : null}

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="jobDetailCardTitle">MOT Status</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                {motCheck ? <button type="button" className="secondaryButton" disabled={motActionStatus === 'arrived'} onClick={markMotArrived}>{motActionStatus === 'arrived' ? 'Marking arrived...' : 'Mark arrived/offsite'}</button> : null}
                {motCheck ? <button type="button" className="secondaryButton" disabled={motActionStatus === 'run'} onClick={runMotNow}>{motActionStatus === 'run' ? 'Checking MOT...' : 'Run check now'}</button> : null}
              </div>
            </div>
            {motActionMessage ? <div className="notice info" style={{ marginBottom: 10 }}>{motActionMessage}</div> : null}
            {motCheck ? (
              <div>
                <div className={`notice ${motCheck.mot_status === 'passed' ? 'good' : motCheck.mot_status === 'failed' ? 'bad' : motCheck.mot_status === 'not_completed' || motCheck.mot_status === 'not_completed_this_year' ? 'warn' : 'info'}`}>
                  Current booked MOT: {motCheck.mot_status_label || motCheck.mot_status || 'Not Completed Yet'}
                </div>
                <div className="fieldGrid" style={{ marginTop: 12 }}>
                  <div className="field"><div className="fieldLabel">Arrival/offsite</div><div>{formatDateTime(motCheck.arrived_at)}</div></div>
                  <div className="field"><div className="fieldLabel">Next automatic check</div><div>{formatDateTime(motCheck.next_check_at)}</div></div>
                  <div className="field"><div className="fieldLabel">Automatic attempts</div><div>{Number(motCheck.check_attempts || 0)}</div></div>
                  <div className="field"><div className="fieldLabel">Last manual check</div><div>{formatDateTime(motCheck.last_manual_checked_at)}</div></div>
                </div>
                <div className="availabilitySummaryRow" style={{ marginTop: 10 }}>
                  <span className="statusChip chipRed">Failures: {Number(motCheck.failures_count || 0)}</span>
                  <span className="statusChip chipYellow">Minors: {Number(motCheck.minors_count || 0)}</span>
                  <span className="statusChip chipGrey">Advisories: {Number(motCheck.advisories_count || 0)}</span>
                </div>
                {(motFaults || []).length ? (
                  <div className="pageHeaderActions" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
                    <button type="button" className="primaryButton" onClick={openMotQuoteBuilder}>Create Repair Quote from MOT</button>
                  </div>
                ) : null}
                {motFaults.some((f) => f.fault_group === 'failures' && Number(f.dangerous) === 1) ? (
                  <div className="notice bad" style={{ marginTop: 10 }}>Dangerous — do not drive</div>
                ) : null}
                <div className="fieldGrid" style={{ marginTop: 12 }}>
                  <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Previous / last known DVSA MOT record</div></div>
                  <div className="field"><div className="fieldLabel">Date</div><div>{motCheck.latest_test_date || 'No previous MOT record returned by webhook.'}</div></div>
                  <div className="field"><div className="fieldLabel">Result</div><div>{motCheck.latest_test_result || '—'}</div></div>
                  <div className="field"><div className="fieldLabel">Expiry</div><div>{motCheck.latest_test_expiry || '—'}</div></div>
                </div>
              </div>
            ) : (
              <div>
                <div className="emptyState">No MOT check linked to this job yet.</div>
                {Number(job.service_is_mot || 0) === 1 ? <button type="button" className="secondaryButton" disabled={motActionStatus === 'creating'} onClick={createMotCheckForJob}>{motActionStatus === 'creating' ? 'Creating...' : 'Create MOT check'}</button> : null}
              </div>
            )}
          </div>

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="jobDetailCardTitle">Vehicle History</h2>
              {job.vehicle_registration ? (
                <button
                  type="button"
                  className="secondaryButton"
                  onClick={() => {
                    window.history.pushState({}, '', '/vehicles')
                    window.dispatchEvent(new PopStateEvent('popstate'))
                  }}
                >
                  Open Full Vehicle History
                </button>
              ) : null}
            </div>
            {vehicleHistoryOverview ? (
              <div>
                <div className="availabilitySummaryRow" style={{ marginTop: 0 }}>
                  <StatusPill>{`REG: ${vehicleHistoryOverview.registration || '—'}`}</StatusPill>
                  <StatusPill>{`Events: ${Number(vehicleHistoryOverview.service_events?.length || 0)}`}</StatusPill>
                  <StatusPill>{`Recommendations: ${Number((vehicleHistoryOverview.maintenance_recommendations || []).filter((r) => ['open', 'planned'].includes(String(r.status || '').toLowerCase())).length)}`}</StatusPill>
                </div>
                <div className="activityTimelineList" style={{ marginTop: 10 }}>
                  {(vehicleHistoryOverview.service_events || []).slice(0, 4).map((entry) => (
                    <div className="activityTimelineItem" key={`veh-${entry.id}`}>
                      <div className="activityTimelineMarker"></div>
                      <div className="activityTimelineContent">
                        <div className="activityTimelineText">{entry.title}</div>
                        <div className="fieldHint">{entry.description || '—'}</div>
                        <div className="activityTimelineMeta">{formatDateTime(entry.event_date || entry.created_at)} · Mileage: {entry.mileage || '—'}</div>
                      </div>
                    </div>
                  ))}
                  {!vehicleHistoryOverview.service_events?.length ? <div className="emptyState">No service history entries yet.</div> : null}
                </div>
                {(vehicleHistoryOverview.maintenance_recommendations || []).filter((r) => ['open', 'planned'].includes(String(r.status || '').toLowerCase())).slice(0, 3).length ? (
                  <div style={{ marginTop: 10 }}>
                    {(vehicleHistoryOverview.maintenance_recommendations || [])
                      .filter((r) => ['open', 'planned'].includes(String(r.status || '').toLowerCase()))
                      .slice(0, 3)
                      .map((r) => (
                        <div key={`rec-${r.id}`} className="notice warn" style={{ marginTop: 6 }}>
                          {r.title} · {r.status} {r.due_date ? `· due ${String(r.due_date).slice(0, 10)}` : ''}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ) : <div className="emptyState">Vehicle history unavailable for this job.</div>}
          </div>

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="jobDetailCardTitle">Scheduling Suggestions</h2>
              <button type="button" className="secondaryButton" onClick={() => refreshSuggestions()}>
                {suggestionsStatus === 'loading' ? 'Refreshing…' : 'Refresh Suggestions'}
              </button>
            </div>
            {suggestionsError ? <div className="notice bad">{suggestionsError}</div> : null}
            {suggestions ? (
              <div>
                <div className="availabilitySummaryRow">
                  <StatusPill>{`Bays available: ${Number(suggestions?.summary?.available_bays || 0)}`}</StatusPill>
                  <StatusPill>{`Technicians available: ${Number(suggestions?.summary?.available_technicians || 0)}`}</StatusPill>
                  <StatusPill>{`Matching skills: ${Number(suggestions?.summary?.matching_technicians || 0)}`}</StatusPill>
                </div>
                {suggestions?.summary?.warnings?.length ? (
                  <div className="availabilityWarnings">
                    {suggestions.summary.warnings.map((w, idx) => <div key={`${w}-${idx}`} className="notice warn">{w}</div>)}
                  </div>
                ) : null}
                <div className="availabilityListsGrid">
                  <div className="availabilityListCard">
                    <h4 className="cardTitle" style={{ marginTop: 0, marginBottom: 8 }}>Suggested bays</h4>
                    {(suggestions?.bay_suggestions || []).slice(0, 5).map((b) => (
                      <div key={b.bay_id} className="availabilityRowItem">
                        <div>
                          <div className="availabilityRowTitle">{b.bay_name} ({b.bay_type || 'general'})</div>
                          <div className="fieldHint">{b.reason}</div>
                        </div>
                        <div className="availabilityRowBadges">
                          {b.is_mot_bay ? <StatusPill>MOT</StatusPill> : null}
                          <StatusPill tone={b.available ? 'good' : 'warn'}>{b.available ? 'Available' : 'Unavailable'}</StatusPill>
                          {b.available ? (
                            <button
                              type="button"
                              className="miniButton"
                              onClick={async () => {
                                await apiPost(`/api/jobs/${jobId}/bay`, { bay_id: Number(b.bay_id), notes: 'Assigned from scheduling suggestion.' })
                                await refreshAssignmentsAndActivity()
                                await refreshSuggestions()
                              }}
                            >
                              Assign this bay
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {!suggestions?.bay_suggestions?.length ? <div className="emptyState">No bay suggestions.</div> : null}
                  </div>
                  <div className="availabilityListCard">
                    <h4 className="cardTitle" style={{ marginTop: 0, marginBottom: 8 }}>Suggested technicians</h4>
                    {(suggestions?.technician_suggestions || []).slice(0, 8).map((t) => (
                      <div key={t.technician_id} className="availabilityRowItem">
                        <div>
                          <div className="availabilityRowTitle">{t.name}</div>
                          <div className="fieldHint">{t.reason}</div>
                          <div className="fieldHint">{(t.matching_skills || []).length ? `Skills: ${t.matching_skills.join(', ')}` : 'No exact matching skills recorded'}</div>
                        </div>
                        <div className="availabilityRowBadges">
                          <StatusPill>{`Active jobs: ${Number(t.active_jobs || 0)}`}</StatusPill>
                          <StatusPill tone={t.available ? 'good' : 'warn'}>{t.available ? 'Available' : 'Busy'}</StatusPill>
                          {t.available ? (
                            <button
                              type="button"
                              className="miniButton"
                              onClick={async () => {
                                await apiPost(`/api/jobs/${jobId}/technicians`, {
                                  technician_id: Number(t.technician_id),
                                  assignment_role: 'suggested_assignment',
                                  status: 'assigned',
                                })
                                await refreshAssignmentsAndActivity()
                                await refreshSuggestions()
                              }}
                            >
                              Assign this technician
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {!suggestions?.technician_suggestions?.length ? <div className="emptyState">No technician suggestions.</div> : null}
                  </div>
                </div>
                {suggestions?.conflicts?.length ? (
                  <div className="availabilityListCard" style={{ marginTop: 10 }}>
                    <h4 className="cardTitle" style={{ marginTop: 0, marginBottom: 8 }}>Conflicts</h4>
                    {suggestions.conflicts.slice(0, 12).map((c, idx) => (
                      <div key={`${c.type}-${c.job_id}-${idx}`} className="availabilityRowItem">
                        <div>
                          <div className="availabilityRowTitle">{String(c.type || '').toUpperCase()} · {c.name || 'Unknown'}</div>
                          <div className="fieldHint">Job #{c.job_id} · {c.registration || 'REG unknown'}</div>
                        </div>
                        <div className="fieldHint">{formatDateTime(c.start)} → {formatDateTime(c.end)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="emptyState">No suggestions loaded.</div>
            )}
          </div>

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="jobDetailCardTitle">Technicians</h2>
              <button type="button" className="secondaryButton" onClick={() => setShowAssignModal(true)}>Assign Technician</button>
            </div>
            {assignments.length ? (
              <div className="quoteTableWrap">
                <table className="quoteTable">
                  <thead>
                    <tr><th>Name</th><th>Role</th><th>Est. hours</th><th>Actual hours</th><th>Status</th><th>Assigned</th><th></th></tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id}>
                        <td>{a.technician_name || `TECH ${a.technician_id}`}</td>
                        <td>{a.assignment_role || '—'}</td>
                        <td>{a.estimated_hours ?? '—'}</td>
                        <td>
                          <button type="button" className="miniButton" onClick={() => {
                            const value = window.prompt('Enter actual hours', a.actual_hours ?? '')
                            if (value == null) return
                            updateAssignment(a, { actual_hours: value })
                          }}>{a.actual_hours ?? 'Set'}</button>
                        </td>
                        <td>
                          <select className="select" value={a.status || 'assigned'} onChange={(e) => updateAssignment(a, { status: e.target.value })}>
                            <option value="assigned">assigned</option>
                            <option value="in_progress">in_progress</option>
                            <option value="completed">completed</option>
                            <option value="paused">paused</option>
                          </select>
                        </td>
                        <td>{formatDateTime(a.assigned_at)}</td>
                        <td><button type="button" className="miniButton" onClick={() => removeAssignment(a)}>Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="emptyState">No technicians assigned yet.</div>}
          </div>

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20, color: 'var(--accent)' }}><circle cx="12" cy="12" r="1"></circle><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path><path d="M5 12h14"></path></svg>
              <h2 className="jobDetailCardTitle">Job Activity</h2>
              <button type="button" className="secondaryButton" style={{ marginLeft: 'auto' }} onClick={() => setShowActivityModal(true)}>Add Internal Note</button>
            </div>
            <div className="activityTimelineList">
              {jobActivity.length ? jobActivity.map((entry) => (
                <div className="activityTimelineItem" key={entry.id}>
                  <div className="activityTimelineMarker"></div>
                  <div className="activityTimelineContent">
                    <div className="activityTimelineText">{entry.title}</div>
                    <div className="fieldHint">{entry.description || '—'}</div>
                    <div className="activityTimelineMeta">{formatDateTime(entry.created_at)} · {entry.technician_name || 'NO TECHNICIAN'}</div>
                  </div>
                </div>
              )) : (
                <div className="emptyState">No activity yet.</div>
              )}
            </div>
          </div>

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 className="jobDetailCardTitle">Customer Communications</h2>
              <button
                type="button"
                className="secondaryButton"
                onClick={() => typeof onOpenCommunications === 'function' && onOpenCommunications(jobId)}
              >
                Open Communications
              </button>
            </div>
            <div className="activityTimelineList">
              {jobCommunications.length ? jobCommunications.slice(0, 12).map((entry) => (
                <div className="activityTimelineItem" key={entry.id}>
                  <div className="activityTimelineMarker"></div>
                  <div className="activityTimelineContent">
                    <div className="activityTimelineText">{entry.channel} · {entry.purpose} · {entry.status}</div>
                    <div className="fieldHint">{String(entry.body || '').slice(0, 180) || '—'}</div>
                    <div className="activityTimelineMeta">{formatDateTime(entry.created_at)} · Sent: {formatDateTime(entry.sent_at)}</div>
                  </div>
                </div>
              )) : (
                <div className="emptyState">No communication history for this job yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="jobDetailSidebar">
          <div className="jobDetailCard">
            <h3 className="jobDetailCardTitle">Quick Actions</h3>
            <div className="jobDetailActionsList">
              <button
                type="button"
                className="primaryButton" style={{ width: '100%' }}
                onClick={createOrOpenQuote}
                disabled={actionStatus === 'saving'}
              >
                {actionStatus === 'saving' ? 'Working…' : 'Create Quote'}
              </button>
              <button
                type="button"
                className="secondaryButton" style={{ width: '100%' }}
                onClick={() => onOpenJobSheet && onOpenJobSheet(job.id)}
              >
                View Job Sheet
              </button>
              <button
                type="button"
                className="secondaryButton" style={{ width: '100%' }}
                onClick={createOrOpenInvoice}
                disabled={actionStatus === 'saving'}
              >
                {actionStatus === 'saving' ? 'Working…' : 'Create Invoice'}
              </button>
            </div>
          </div>

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <h3 className="jobDetailCardTitle">Summary</h3>
            <div className="jobDetailSummaryList">
              <div className="jobDetailSummaryRow">
                <span className="jobDetailSummaryLabel">Booked start</span>
                <span className="jobDetailSummaryValue">{formatDateTime(job.booked_start)}</span>
              </div>
              <div className="jobDetailSummaryRow">
                <span className="jobDetailSummaryLabel">Booked end</span>
                <span className="jobDetailSummaryValue">{formatDateTime(job.booked_end)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="jobDetailSection" style={{ marginTop: 24 }}>
        <h3 className="jobDetailSectionTitle">Inventory Usage</h3>
        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Inventory item</div>
            <select className="select" value={inventoryDraft.inventory_item_id} onChange={(e) => setInventoryDraft((s) => ({ ...s, inventory_item_id: e.target.value }))}>
              <option value="">Select item</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.sku || `ID ${item.id}`})</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <div className="fieldLabel">Quantity</div>
            <input className="input" value={inventoryDraft.quantity} onChange={(e) => setInventoryDraft((s) => ({ ...s, quantity: e.target.value }))} placeholder="e.g. 1 or 0.5" />
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Notes</div>
            <input className="input" value={inventoryDraft.notes} onChange={(e) => setInventoryDraft((s) => ({ ...s, notes: e.target.value }))} placeholder="Optional usage note" />
          </div>
          <div className="field" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'end' }}>
            <button type="button" className="secondaryButton" onClick={recordInventoryUsage}>Record usage</button>
          </div>
        </div>
        {inventoryUsage.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead><tr><th>Item</th><th>Quantity</th><th>Type</th><th>Date</th><th>Notes / Ref</th></tr></thead>
              <tbody>
                {inventoryUsage.map((row) => (
                  <tr key={row.id}>
                    <td>{row.item_name || `Item ${row.inventory_item_id}`}</td>
                    <td>{Number(row.quantity || 0).toLocaleString('en-GB', { maximumFractionDigits: 3 })} {row.unit_of_measure || ''}</td>
                    <td>{row.movement_type}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>{row.notes || row.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>No linked inventory usage yet.</div>
        )}
      </div>

      <div className="jobDetailSection" style={{ marginTop: 24 }}>
        <h3 className="jobDetailSectionTitle">Notes</h3>
        <div className="jobDetailNotesGrid">
          <div className="jobDetailNoteField">
            <div className="jobDetailLabel">Customer Notes</div>
            <textarea className="textarea" value={job.notes_customer_words || ''} readOnly />
          </div>
          <div className="jobDetailNoteField">
            <div className="jobDetailLabel">Internal Notes</div>
            <textarea className="textarea" value={job.notes_internal || ''} readOnly />
          </div>
        </div>
      </div>

      <div className="jobDetailSection" style={{ marginTop: 24 }}>
        <h3 className="jobDetailSectionTitle">Quotes</h3>
        {quotes.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Total</th>
                  <th>Updated</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="mono">{q.quote_number}</td>
                    <td>{q.status}</td>
                    <td>{q.title}</td>
                    <td>{q.total_sell != null ? `£${Number(q.total_sell).toFixed(2)}` : '—'}</td>
                    <td>{formatDateTime(q.updated_at)}</td>
                    <td>
                      <button type="button" className="miniButton primary" onClick={() => onOpenQuote(q.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            No linked quotes yet.
          </div>
        )}
      </div>

      <div className="jobDetailSection" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="jobDetailSectionTitle">Job Sheet</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="secondaryButton noPrint" onClick={() => onOpenJobSheet && onOpenJobSheet(job.id)}>View job sheet</button>
            <button type="button" className="secondaryButton noPrint" onClick={() => window.print()}>Print</button>
          </div>
        </div>
        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Technician</div>
            <div>{jobSheet?.job?.technician_name || '—'}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Mileage in</div>
            <div>{jobSheet?.job?.mileage_in || '—'}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Mileage out</div>
            <div>{jobSheet?.job?.mileage_out || '—'}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Quote</div>
            <div>{jobSheet?.quote ? `${jobSheet.quote.quote_number} (${jobSheet.quote.status})` : '—'}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 12' }}>
            <div className="fieldLabel">Checklist / tasks</div>
            <div className="printBox">{jobSheet?.job?.job_checklist || 'NO CHECKLIST ENTERED YET.'}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Technician notes</div>
            <div className="printBox">{jobSheet?.job?.technician_notes || '—'}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Extra work found</div>
            <div className="printBox">{jobSheet?.job?.extra_work_found || '—'}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 12' }}>
            <div className="fieldLabel">Final checks / signature</div>
            <div className="printBox">{jobSheet?.job?.final_checks || 'TECHNICIAN SIGN-OFF: ____________________  DATE: __________'}</div>
          </div>
        </div>
      </div>

      <div className="jobDetailSection" style={{ marginTop: 24 }}>
        <h3 className="jobDetailSectionTitle">Invoices</h3>
        {invoices.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead><tr><th>Invoice</th><th>Status</th><th>Payment</th><th>Total</th><th>Paid</th><th>Balance</th><th></th></tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoice_number}</td>
                    <td>{inv.status}</td>
                    <td>{inv.payment_status || 'unpaid'}</td>
                    <td>£{Number(inv.total_inc_vat || 0).toFixed(2)}</td>
                    <td>£{Number(inv.amount_paid || 0).toFixed(2)}</td>
                    <td>£{Number(inv.balance_due != null ? inv.balance_due : Math.max(0, Number(inv.total_inc_vat || 0) - Number(inv.amount_paid || 0))).toFixed(2)}</td>
                    <td>
                      <button type="button" className="miniButton" onClick={() => onOpenInvoice && onOpenInvoice(inv.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="emptyState" style={{ marginTop: 12 }}>No invoice yet.</div>}
      </div>

      <div className="jobDetailSection" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className="jobDetailSectionTitle">Parts orders</h3>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              if (typeof onViewPartsOrders === 'function') onViewPartsOrders(job.id)
            }}
          >
            View parts
          </button>
        </div>

        {partsOrders.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Part</th>
                  <th>Supplier</th>
                  <th>Qty</th>
                  <th>ETA</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {partsOrders.map((po) => (
                  <tr key={po.id}>
                    <td>
                      <StatusChip label={po.status} tone={partsOrderTone(po.status)} />
                    </td>
                    <td>{po.part_name || po.description || '—'}</td>
                    <td>{po.supplier_name || '—'}</td>
                    <td className="mono">{po.quantity}</td>
                    <td>{po.eta_text || formatDateTime(po.expected_at || po.eta_datetime)}</td>
                    <td className="mono">{po.supplier_invoice_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            No parts orders yet. Accepting a quote can create parts orders automatically.
          </div>
        )}
      </div>

      {showAssignModal ? (
        <div className="modalOverlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cardTitle">Assign Technician</h3>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <div className="field"><div className="fieldLabel">Technician</div><select className="select" value={assignDraft.technician_id} onChange={(e) => setAssignDraft((d) => ({ ...d, technician_id: e.target.value }))}><option value="">Select technician…</option>{technicians.filter((t) => Number(t.active) === 1).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="field"><div className="fieldLabel">Assignment role</div><input className="input" value={assignDraft.assignment_role} onChange={(e) => setAssignDraft((d) => ({ ...d, assignment_role: e.target.value }))} /></div>
              <div className="field"><div className="fieldLabel">Estimated hours</div><input className="input" value={assignDraft.estimated_hours} onChange={(e) => setAssignDraft((d) => ({ ...d, estimated_hours: e.target.value }))} /></div>
              <div className="field"><div className="fieldLabel">Status</div><select className="select" value={assignDraft.status} onChange={(e) => setAssignDraft((d) => ({ ...d, status: e.target.value }))}><option value="assigned">assigned</option><option value="in_progress">in_progress</option><option value="completed">completed</option><option value="paused">paused</option></select></div>
              <div className="pageHeaderActions"><button type="button" className="secondaryButton" onClick={() => setShowAssignModal(false)}>Cancel</button><button type="button" className="primaryButton" onClick={addAssignment}>Save</button></div>
            </div>
          </div>
        </div>
      ) : null}

      {showBayModal ? (
        <div className="modalOverlay" onClick={() => setShowBayModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cardTitle">Assign Workshop Bay</h3>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <div className="field"><div className="fieldLabel">Bay</div><select className="select" value={bayDraft.bay_id} onChange={(e) => setBayDraft((d) => ({ ...d, bay_id: e.target.value }))}><option value="">Select bay…</option>{bays.filter((b) => Number(b.active) === 1).map((b) => <option key={b.id} value={b.id}>{b.name} ({b.bay_type}){Number(b.is_mot_bay) ? ' - MOT' : ''}</option>)}</select></div>
              <div className="field"><div className="fieldLabel">Notes (optional)</div><textarea className="textarea" rows={4} value={bayDraft.notes} onChange={(e) => setBayDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
              <div className="pageHeaderActions"><button type="button" className="secondaryButton" onClick={() => setShowBayModal(false)}>Cancel</button><button type="button" className="primaryButton" onClick={assignBay}>Save</button></div>
            </div>
          </div>
        </div>
      ) : null}

      {showActivityModal ? (
        <div className="modalOverlay" onClick={() => setShowActivityModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cardTitle">Add Job Activity</h3>
            <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
              <div className="field"><div className="fieldLabel">Event type</div><input className="input" value={activityDraft.event_type} onChange={(e) => setActivityDraft((d) => ({ ...d, event_type: e.target.value }))} /></div>
              <div className="field"><div className="fieldLabel">Title</div><input className="input" value={activityDraft.title} onChange={(e) => setActivityDraft((d) => ({ ...d, title: e.target.value }))} /></div>
              <div className="field"><div className="fieldLabel">Description</div><textarea className="textarea" rows={4} value={activityDraft.description} onChange={(e) => setActivityDraft((d) => ({ ...d, description: e.target.value }))} /></div>
              <div className="field"><div className="fieldLabel">Technician (optional)</div><select className="select" value={activityDraft.technician_id} onChange={(e) => setActivityDraft((d) => ({ ...d, technician_id: e.target.value }))}><option value="">No technician</option>{technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div className="pageHeaderActions"><button type="button" className="secondaryButton" onClick={() => setShowActivityModal(false)}>Cancel</button><button type="button" className="primaryButton" onClick={addActivityEvent}>Save</button></div>
            </div>
          </div>
        </div>
      ) : null}

      {motQuoteOpen ? (
        <div className="modalOverlay" onClick={() => setMotQuoteOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <h3 className="cardTitle">MOT Repair Quote Builder</h3>
                <div className="fieldHint">Prices must be reviewed before sending to customer.</div>
              </div>
              <button type="button" className="miniButton" onClick={() => setMotQuoteOpen(false)}>Close</button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 10, maxHeight: '50vh', overflow: 'auto' }}>
              {motQuoteDrafts.map((f, idx) => (
                <div key={`${f.fault_id}-${idx}`} className="cardBox" style={{ padding: 12 }}>
                  <div className="pageHeaderActions" style={{ justifyContent: 'space-between' }}>
                    <label className="inlineCheck"><input type="checkbox" checked={Boolean(f.include)} onChange={(e) => setMotQuoteDraft(idx, { include: e.target.checked })} /><span>Include</span></label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="statusChip chipGrey">{f.fault_group}</span>
                      {f.dangerous ? <span className="statusChip chipRed">dangerous</span> : null}
                    </div>
                  </div>
                  <div className="fieldGrid" style={{ marginTop: 8 }}>
                    <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Line title</div><input className="input" value={f.title} onChange={(e) => setMotQuoteDraft(idx, { title: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Description</div><input className="input" value={f.description} onChange={(e) => setMotQuoteDraft(idx, { description: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Parts cost</div><input className="input" value={f.parts_cost} onChange={(e) => setMotQuoteDraft(idx, { parts_cost: e.target.value })} /></div>
                    <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Sell price</div><input className="input" value={f.sell_price} onChange={(e) => setMotQuoteDraft(idx, { sell_price: e.target.value })} /></div>
                  </div>
                </div>
              ))}
            </div>
            {motQuoteResult?.ok === false ? <div className="notice bad" style={{ marginTop: 10 }}>{motQuoteResult.error}</div> : null}
            {motQuoteResult?.ok ? <div className="notice good" style={{ marginTop: 10 }}>{motQuoteResult.message}</div> : null}
            <div className="pageHeaderActions" style={{ marginTop: 12, justifyContent: 'space-between' }}>
              <button type="button" className="secondaryButton" onClick={() => setMotQuoteOpen(false)}>Stay on Job</button>
              <div style={{ display: 'flex', gap: 8 }}>
                {motQuoteResult?.quote?.id ? <button type="button" className="secondaryButton" onClick={() => onOpenQuote && onOpenQuote(motQuoteResult.quote.id)}>Open Quote</button> : null}
                <button type="button" className="primaryButton" disabled={motQuoteLoading} onClick={createMotQuote}>{motQuoteLoading ? 'Creating draft quote...' : 'Create Draft Quote'}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}

function StatusPill({ children, tone }) {
  return <span className={`statusPill ${tone || ''}`}>{children}</span>
}
