import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { jobPartsSummaryTone } from '../utils/statusChips'
import StatusChip from '../components/StatusChip'
import VehicleHeader from '../components/VehicleHeader'

function parseQuery(locationPath) {
  const q = String(locationPath || '').split('?')[1] || ''
  const params = new URLSearchParams(q)
  const needsQuote = params.get('needs_quote') === '1' || params.get('needs_quote') === 'true'
  const search = String(params.get('q') || '').trim()
  const status = String(params.get('status') || '').trim()
  return { needsQuote, search, status }
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

export default function Jobs({ locationPath, onOpenJob, onOpenQuote }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState([])

  const query = useMemo(() => parseQuery(locationPath), [locationPath])

  const [q, setQ] = useState(() => query.search || '')
  const [statusFilter, setStatusFilter] = useState(() => query.status || '')

  const [actionStatus, setActionStatus] = useState('idle')
  const [actionError, setActionError] = useState('')
  const [viewMode, setViewMode] = useState('all')

  useEffect(() => {
    // Keep the UI in sync with URL query params (used by global search + dashboard shortcuts).
    setQ(query.search || '')
    setStatusFilter(query.status || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.search, query.status, query.needsQuote])

  useEffect(() => {
    setDocumentTitle('Jobs')
  }, [])

  const grouped = useMemo(() => {
    const out = {
      all: jobs,
      today: [],
      needs_quote: [],
      waiting_parts: [],
      in_progress: [],
      completed: [],
    }
    const today = new Date().toISOString().slice(0, 10)
    for (const job of jobs) {
      const statusText = String(job.status || '').toLowerCase()
      const bookedDate = String(job.booked_start || job.requested_date || '').slice(0, 10)
      if (bookedDate === today) out.today.push(job)
      if (!job.quote_exists) out.needs_quote.push(job)
      if (String(job.parts_status || '').toLowerCase().includes('waiting') || String(job.parts_status || '').toLowerCase().includes('to order')) {
        out.waiting_parts.push(job)
      }
      if (statusText.includes('progress')) out.in_progress.push(job)
      if (statusText === 'completed') out.completed.push(job)
    }
    return out
  }, [jobs])

  const visibleJobs = grouped[viewMode] || jobs

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (statusFilter) params.set('status', statusFilter)
      if (query.needsQuote) params.set('needs_quote', '1')
      const data = await apiGet(`/api/jobs?${params.toString()}`)
      setJobs(data.jobs || [])
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(
        err.message ||
          'Failed to load jobs. The backend returned an error. Database setup may be required (open Set-up).',
      )
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.needsQuote, query.search, query.status])

  async function createOrOpenQuote(job) {
    if (!job) return
    setActionStatus('saving')
    setActionError('')
    try {
      const data = await apiPost(`/api/jobs/${job.id}/quotes`, {})
      if (data && data.quote && data.quote.id) {
        onOpenQuote(data.quote.id)
      }
      setActionStatus('idle')
    } catch (err) {
      setActionStatus('error')
      setActionError(err.message || 'Failed to create/open quote.')
    }
  }

  return (
    <div className="jobsPage">
      <header className="jobsPageHeader">
        <div>
          <h1 className="jobsPageTitle">Jobs</h1>
          <p className="jobsPageSubtitle">Manage all service jobs</p>
        </div>
        <button className="primaryButton" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Job
        </button>
      </header>

      <div className="jobsSearchCard">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--muted)' }}><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
            <input
              className="jobsSearchInput"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by job ID, customer, vehicle..."
            />
          </div>
          <button className="secondaryButton" style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            Filters
          </button>
        </div>
      </div>

      <div className="jobsResultsCard">
        <div style={{ borderBottom: '1px solid var(--separator)', paddingBottom: 12, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Results</h3>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{visibleJobs.length} job(s)</span>
        </div>

        <div className="jobsFilterTabs">
          <button type="button" className={`jobsFilterTab ${viewMode === 'all' ? 'active' : ''}`} onClick={() => setViewMode('all')}>
            All ({grouped.all.length})
          </button>
          <button type="button" className={`jobsFilterTab ${viewMode === 'today' ? 'active' : ''}`} onClick={() => setViewMode('today')}>
            Today ({grouped.today.length})
          </button>
          <button type="button" className={`jobsFilterTab ${viewMode === 'needs_quote' ? 'active' : ''}`} onClick={() => setViewMode('needs_quote')}>
            Needs Quote ({grouped.needs_quote.length})
          </button>
          <button type="button" className={`jobsFilterTab ${viewMode === 'waiting_parts' ? 'active' : ''}`} onClick={() => setViewMode('waiting_parts')}>
            Waiting Parts ({grouped.waiting_parts.length})
          </button>
          <button type="button" className={`jobsFilterTab ${viewMode === 'in_progress' ? 'active' : ''}`} onClick={() => setViewMode('in_progress')}>
            In Progress ({grouped.in_progress.length})
          </button>
          <button type="button" className={`jobsFilterTab ${viewMode === 'completed' ? 'active' : ''}`} onClick={() => setViewMode('completed')}>
            Completed ({grouped.completed.length})
          </button>
        </div>

        {error ? <div className="notice bad" style={{ marginTop: 12 }}>{error}</div> : null}
        {actionError ? <div className="notice bad" style={{ marginTop: 12 }}>{actionError}</div> : null}

        {status === 'loading' ? (
          <div className="emptyState" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : visibleJobs.length ? (
          <div className="jobsTableWrapper" style={{ marginTop: 12 }}>
            <table className="jobsTable">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Booked</th>
                  <th>Quote</th>
                  <th>Parts</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((j) => (
                  <tr key={j.id} className="jobsTableRow">
                    <td>
                      <div className="jobIdCell">
                        <div className="jobIdBadge">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><path d="M6.5 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path><path d="M9 9h6"></path><path d="M9 13h6"></path></svg>
                        </div>
                        <span>{j.id}</span>
                      </div>
                    </td>
                    <td className="jobCustomerCell">
                      {j.customer_first_name} {j.customer_surname}
                    </td>
                    <td className="jobVehicleCell">
                      <VehicleHeader
                        small
                        reg={j.vehicle_registration}
                        make={j.vehicle_make}
                        model={j.vehicle_model}
                      />
                    </td>
                    <td className="jobServiceCell">
                      {j.title || j.service_template_name || `Job #${j.id}`}
                    </td>
                    <td>
                      <StatusChip label={j.status} tone="chipGrey" />
                    </td>
                    <td className="jobBookedCell">
                      {formatDateTime(j.booked_start)}
                    </td>
                    <td>
                      {j.quote_exists ? (
                        <StatusChip
                          label={`${j.latest_quote_number ? `${j.latest_quote_number} ` : ''}${j.latest_quote_status || 'quote'}`}
                          tone="chipGrey"
                        />
                      ) : (
                        <span className="fieldHint">No quote</span>
                      )}
                    </td>
                    <td>
                      <StatusChip label={j.parts_status || '—'} tone={jobPartsSummaryTone(j.parts_status)} />
                    </td>
                    <td className="jobActionsCell">
                      <button
                        type="button"
                        className="primaryButton" style={{ fontSize: 12, padding: '6px 12px' }}
                        onClick={() => onOpenJob(j.id)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            No jobs found.
          </div>
        )}
      </div>
    </div>
  )
}
