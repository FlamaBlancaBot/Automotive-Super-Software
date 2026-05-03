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
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Jobs</h2>
          <p className="pageSubtitle">
            Search by REG, customer, phone, or job title. Create/open a quote from the job row.
          </p>
        </div>
        <span className="setupPill" title="Database-backed">
          Live
        </span>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Search</h3>
          <div className="fieldHint">
            {query.needsQuote ? 'Showing jobs needing a quote.' : 'Showing recent jobs.'}
          </div>
        </div>

        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 8' }}>
            <div className="fieldLabel">Search</div>
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. AB12 CDE, Smith, 07123"
            />
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Status</div>
            <input
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="e.g. booked_in"
            />
          </div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <button type="button" className="secondaryButton" onClick={load}>
            {status === 'loading' ? 'Loading…' : 'Search'}
          </button>
          {actionStatus === 'saving' ? <span className="fieldHint">Working…</span> : null}
        </div>

        {error ? <div className="notice bad">{error}</div> : null}
        {actionError ? <div className="notice bad">{actionError}</div> : null}
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Results</h3>
          <div className="fieldHint">{visibleJobs.length} job(s)</div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <button type="button" className={`miniButton ${viewMode === 'all' ? 'primary' : ''}`} onClick={() => setViewMode('all')}>
            All ({grouped.all.length})
          </button>
          <button type="button" className={`miniButton ${viewMode === 'today' ? 'primary' : ''}`} onClick={() => setViewMode('today')}>
            Today ({grouped.today.length})
          </button>
          <button type="button" className={`miniButton ${viewMode === 'needs_quote' ? 'primary' : ''}`} onClick={() => setViewMode('needs_quote')}>
            Needs Quote ({grouped.needs_quote.length})
          </button>
          <button type="button" className={`miniButton ${viewMode === 'waiting_parts' ? 'primary' : ''}`} onClick={() => setViewMode('waiting_parts')}>
            Waiting Parts ({grouped.waiting_parts.length})
          </button>
          <button type="button" className={`miniButton ${viewMode === 'in_progress' ? 'primary' : ''}`} onClick={() => setViewMode('in_progress')}>
            In Progress ({grouped.in_progress.length})
          </button>
          <button type="button" className={`miniButton ${viewMode === 'completed' ? 'primary' : ''}`} onClick={() => setViewMode('completed')}>
            Completed ({grouped.completed.length})
          </button>
        </div>

        {status === 'loading' ? (
          <div className="emptyState" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : jobs.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Job</th>
                  <th>Booked</th>
                  <th>Quote</th>
                  <th>Parts</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <StatusChip label={j.status} tone="chipGrey" />
                    </td>
                    <td>
                      <VehicleHeader
                        small
                        reg={j.vehicle_registration}
                        make={j.vehicle_make}
                        model={j.vehicle_model}
                      />
                    </td>
                    <td>
                      {j.customer_first_name} {j.customer_surname}
                    </td>
                    <td>
                      <div style={{ fontWeight: 900 }}>{j.title}</div>
                      <div className="fieldHint">{j.service_template_name} · JOB #{j.id}</div>
                    </td>
                    <td>{formatDateTime(j.booked_start)}</td>
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
                    <td>
                      <div className="rowActions">
                        <button
                          type="button"
                          className="miniButton"
                          onClick={() => onOpenJob(j.id)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="miniButton primary"
                          onClick={() => {
                            if (j.latest_quote_id) onOpenQuote(j.latest_quote_id)
                            else createOrOpenQuote(j)
                          }}
                        >
                          {j.latest_quote_id ? 'Open quote' : 'Create quote'}
                        </button>
                      </div>
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
