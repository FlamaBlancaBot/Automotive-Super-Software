import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

function formatMoney(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '£0.00'
  return `£${n.toFixed(2)}`
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

function normaliseReg(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 9)
}

function parseQuery(locationPath) {
  const q = String(locationPath || '').split('?')[1] || ''
  const params = new URLSearchParams(q)
  const customerId = Number(params.get('customer_id') || 0) || 0
  const vehicleId = Number(params.get('vehicle_id') || 0) || 0
  const jobId = Number(params.get('job_id') || 0) || 0
  const reg = String(params.get('reg') || '').trim()
  const service = String(params.get('service') || '').trim()
  const title = String(params.get('title') || '').trim()
  return { customerId, vehicleId, jobId, reg, service, title }
}

export default function Quotes({ onOpenQuote, locationPath }) {
  const [listStatus, setListStatus] = useState('idle')
  const [listError, setListError] = useState('')
  const [quotes, setQuotes] = useState([])

  const [regInput, setRegInput] = useState('')
  const [vehicleStatus, setVehicleStatus] = useState('idle')
  const [vehicleMessage, setVehicleMessage] = useState('')
  const [vehicle, setVehicle] = useState(null)
  const [linkedCustomers, setLinkedCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerStatus, setCustomerStatus] = useState('idle')
  const [customerMatches, setCustomerMatches] = useState([])

  const [title, setTitle] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [createStatus, setCreateStatus] = useState('idle')
  const [createError, setCreateError] = useState('')

  const intakePrefill = useMemo(() => parseQuery(locationPath), [locationPath])

  const [jobsStatus, setJobsStatus] = useState('idle')
  const [jobsError, setJobsError] = useState('')
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    setDocumentTitle('Quotes')
  }, [])

  async function loadQuotes() {
    setListStatus('loading')
    setListError('')
    try {
      const data = await apiGet('/api/quotes')
      setQuotes(data.quotes || [])
      setListStatus('ready')
    } catch (err) {
      setListStatus('error')
      setListError(
        err.message ||
          'Failed to load quotes. The backend returned an error. Database setup may be required (open Set-up).',
      )
    }
  }

  useEffect(() => {
    loadQuotes()
  }, [])

  const selectedCustomer = useMemo(() => {
    const id = Number(selectedCustomerId || 0)
    if (!id) return null
    return (
      linkedCustomers.find((c) => c.id === id) ||
      customerMatches.find((c) => c.id === id) ||
      null
    )
  }, [selectedCustomerId, linkedCustomers, customerMatches])

  async function lookupVehicle() {
    const reg = normaliseReg(regInput)
    if (!reg) return

    setVehicleStatus('loading')
    setVehicleMessage('')
    setVehicle(null)
    setLinkedCustomers([])
    setSelectedCustomerId('')
    setCustomerMatches([])
    setCustomerQuery('')

    try {
      const data = await apiGet(`/api/vehicles/${encodeURIComponent(reg)}/matches`)
      if (!data.found) {
        setVehicleStatus('ready')
        setVehicleMessage(data.message || 'Vehicle not found.')
        return
      }

      setVehicleStatus('ready')
      setVehicleMessage('')
      setVehicle(data.vehicle)
      setLinkedCustomers(data.customers || [])
      if (data.customers && data.customers.length) {
        setSelectedCustomerId(String(data.customers[0].id))
      }

      await loadJobsForReg(reg)
    } catch (err) {
      setVehicleStatus('error')
      setVehicleMessage(
        err.message ||
          'Vehicle lookup failed. The backend returned an error. Database setup may be required (open Set-up).',
      )
    }
  }

  async function checkCustomer() {
    const q = String(customerQuery || '').trim()
    if (!q) return

    setCustomerStatus('loading')
    setCustomerMatches([])
    try {
      const data = await apiGet(`/api/customers/search?q=${encodeURIComponent(q)}`)
      setCustomerStatus('ready')
      setCustomerMatches(data.customers || [])
    } catch (err) {
      setCustomerStatus('error')
      setCustomerMatches([])
    }
  }

  const canCreate = Boolean(vehicle && Number(selectedCustomerId) && title.trim())

  const canCreateFromIntake =
    Boolean(intakePrefill.customerId && intakePrefill.vehicleId && intakePrefill.jobId) &&
    createStatus !== 'saving'

  async function createQuoteFromIntake() {
    if (!canCreateFromIntake) return
    setCreateStatus('saving')
    setCreateError('')
    try {
      const data = await apiPost(`/api/jobs/${intakePrefill.jobId}/quotes`, {})

      setCreateStatus('saved')
      setInternalNotes('')
      setCustomerNotes('')
      await loadQuotes()
      if (data && data.quote && data.quote.id && onOpenQuote) {
        onOpenQuote(data.quote.id)
      }
    } catch (err) {
      setCreateStatus('error')
      setCreateError(
        err.message ||
          'Failed to create quote for this job. The backend returned an error. Database setup may be required (open Set-up).',
      )
    }
  }

  async function createQuote() {
    if (!canCreate) return
    setCreateStatus('saving')
    setCreateError('')
    try {
      const data = await apiPost('/api/quotes', {
        customer_id: Number(selectedCustomerId),
        vehicle_id: vehicle.id,
        title: title.trim(),
        internal_notes: internalNotes.trim() || null,
        customer_notes: customerNotes.trim() || null,
      })
      setCreateStatus('saved')
      setTitle('')
      setInternalNotes('')
      setCustomerNotes('')
      await loadQuotes()
      if (data && data.quote && data.quote.id && onOpenQuote) {
        onOpenQuote(data.quote.id)
      }
    } catch (err) {
      setCreateStatus('error')
      setCreateError(
        err.message ||
          'Failed to create quote. The backend returned an error. Database setup may be required (open Set-up).',
      )
    }
  }

  async function loadJobsForReg(reg) {
    const q = String(reg || '').trim()
    if (!q) return
    setJobsStatus('loading')
    setJobsError('')
    try {
      const data = await apiGet(`/api/jobs?q=${encodeURIComponent(q)}`)
      setJobs(data.jobs || [])
      setJobsStatus('ready')
    } catch (err) {
      setJobsStatus('error')
      setJobsError(err.message || 'Failed to load jobs for this REG.')
      setJobs([])
    }
  }

  async function openOrCreateQuoteForJob(job) {
    if (!job || !job.id) return
    setCreateStatus('saving')
    setCreateError('')
    try {
      const data = await apiPost(`/api/jobs/${job.id}/quotes`, {})
      setCreateStatus('idle')
      if (data && data.quote && data.quote.id && onOpenQuote) onOpenQuote(data.quote.id)
    } catch (err) {
      setCreateStatus('error')
      setCreateError(err.message || 'Failed to create/open quote for this job.')
    }
  }

  return (
    <div className="quotes">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Quotes</h2>
          <p className="pageSubtitle">
            Quote Builder MVP (database-backed). Create quotes against existing
            customers and vehicles.
          </p>
        </div>
        <span className="setupPill" title="Early preview">
          MVP
        </span>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Create Quote</h3>
          <div className="fieldHint">
            Uses existing customer/vehicle records for now.
          </div>
        </div>

        {intakePrefill.customerId && intakePrefill.vehicleId && intakePrefill.jobId ? (
          <div className="notice info" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900 }}>
              Next step after onboarding: create a quote for job #{intakePrefill.jobId}
            </div>
            <div className="fieldHint" style={{ marginTop: 6 }}>
              {intakePrefill.reg ? `Vehicle: ${intakePrefill.reg}. ` : ''}
              {intakePrefill.service ? `Service: ${intakePrefill.service}. ` : ''}
              This uses the saved onboarding/job IDs (no demo data).
            </div>
            <div className="pageHeaderActions" style={{ marginTop: 10 }}>
              <button
                type="button"
                className="primaryButton"
                onClick={createQuoteFromIntake}
                disabled={!canCreateFromIntake}
              >
                {createStatus === 'saving' ? 'Creating…' : 'Create quote for this job'}
              </button>
            </div>
            {createError ? <div className="fieldHint" style={{ marginTop: 8 }}>{createError}</div> : null}
          </div>
        ) : null}

        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Vehicle REG</div>
            <div className="quoteRegRow">
              <input
                className="input"
                value={regInput}
                onChange={(e) => setRegInput(normaliseReg(e.target.value))}
                placeholder="AB12 CDE"
                maxLength={9}
              />
              <button
                type="button"
                className="secondaryButton"
                onClick={lookupVehicle}
                disabled={!normaliseReg(regInput) || vehicleStatus === 'loading'}
              >
                {vehicleStatus === 'loading' ? 'Looking up…' : 'Lookup'}
              </button>
            </div>
            {vehicleMessage ? <div className="fieldHint">{vehicleMessage}</div> : null}
          </div>

          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Customer</div>
            {vehicle && linkedCustomers.length ? (
              <>
                <select
                  className="select"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                >
                  {linkedCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.surname} ({c.phone})
                    </option>
                  ))}
                </select>
                <div className="fieldHint">
                  Linked customers are shown from the vehicle record.
                </div>
              </>
            ) : vehicle ? (
              <>
                <div className="quoteRegRow">
                  <input
                    className="input"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder="Search customer by name or phone"
                  />
                  <button
                    type="button"
                    className="secondaryButton"
                    onClick={checkCustomer}
                    disabled={!String(customerQuery).trim() || customerStatus === 'loading'}
                  >
                    {customerStatus === 'loading' ? 'Checking…' : 'Check'}
                  </button>
                </div>
                {customerMatches.length ? (
                  <select
                    className="select"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    style={{ marginTop: 8 }}
                  >
                    <option value="">Select customer…</option>
                    {customerMatches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.surname} ({c.phone})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="fieldHint" style={{ marginTop: 8 }}>
                    No linked customer. Search and select an existing customer.
                  </div>
                )}
              </>
            ) : (
              <div className="fieldHint">Lookup a vehicle first.</div>
            )}
          </div>

          {vehicle ? (
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="fieldLabel">Jobs for this REG</div>
              <div className="fieldHint">
                Create a quote against the correct job where possible.
              </div>

              {jobsError ? <div className="notice bad">{jobsError}</div> : null}

              {jobsStatus === 'loading' ? (
                <div className="emptyState" style={{ marginTop: 10 }}>
                  Loading jobs…
                </div>
              ) : jobs.length ? (
                <div className="quoteTableWrap" style={{ marginTop: 10 }}>
                  <table className="quoteTable" style={{ minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Booked</th>
                        <th>Job</th>
                        <th>Quote</th>
                        <th aria-label="Actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.slice(0, 8).map((j) => (
                        <tr key={j.id}>
                          <td className="mono">{j.id}</td>
                          <td>{formatDateTime(j.booked_start)}</td>
                          <td>
                            <div style={{ fontWeight: 900 }}>{j.title}</div>
                            <div className="fieldHint">{j.service_template_name}</div>
                          </td>
                          <td>
                            {j.quote_exists ? (
                              <span className="statusChip">
                                {j.latest_quote_status || 'quote'}
                              </span>
                            ) : (
                              <span className="fieldHint">No quote</span>
                            )}
                          </td>
                          <td>
                            <div className="rowActions">
                              {j.latest_quote_id ? (
                                <button
                                  type="button"
                                  className="miniButton primary"
                                  onClick={() => onOpenQuote(j.latest_quote_id)}
                                >
                                  Open quote
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="miniButton primary"
                                  onClick={() => openOrCreateQuoteForJob(j)}
                                  disabled={createStatus === 'saving'}
                                >
                                  Create quote
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="emptyState" style={{ marginTop: 10 }}>
                  No jobs found for this REG yet.
                </div>
              )}
            </div>
          ) : null}

          <div className="field" style={{ gridColumn: 'span 12' }}>
            <div className="fieldLabel">Quote title</div>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Front brakes quote (standalone)"
            />
            {vehicle && selectedCustomer ? (
              <div className="fieldHint">
                Creating for {vehicle.registration} — {selectedCustomer.first_name}{' '}
                {selectedCustomer.surname}
              </div>
            ) : null}
            <div className="fieldHint">
              Standalone quotes are allowed, but job-linked quotes are preferred.
            </div>
          </div>

          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Internal notes</div>
            <textarea
              className="textarea"
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={3}
              placeholder="Office notes (not shown to customer yet)"
            />
          </div>

          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Customer notes</div>
            <textarea
              className="textarea"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={3}
              placeholder="Customer-facing notes (later)"
            />
          </div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="primaryButton"
            disabled={!canCreate || createStatus === 'saving'}
            onClick={createQuote}
          >
            {createStatus === 'saving' ? 'Creating…' : 'Create Quote'}
          </button>
          {createError ? <div className="notice bad">{createError}</div> : null}
        </div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Quote List</h3>
          <div className="fieldHint">
            {listStatus === 'loading' ? 'Loading…' : `${quotes.length} quotes`}
          </div>
        </div>

        {listError ? <div className="notice bad">{listError}</div> : null}

        {quotes.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Status</th>
                  <th>REG</th>
                  <th>Vehicle</th>
                  <th>Customer</th>
                  <th>Title</th>
                  <th>Total</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="mono">{q.quote_number}</td>
                    <td>{q.status}</td>
                    <td className="mono">{q.vehicle_registration || '—'}</td>
                    <td>
                      {[q.vehicle_make, q.vehicle_model].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td>
                      {[q.customer_first_name, q.customer_surname].filter(Boolean).join(' ') ||
                        '—'}
                    </td>
                    <td>{q.title}</td>
                    <td>{formatMoney(q.total_sell)}</td>
                    <td>{formatDateTime(q.updated_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="secondaryButton"
                        onClick={() => onOpenQuote && onOpenQuote(q.id)}
                      >
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
            No quotes yet. Create your first quote above.
          </div>
        )}
      </div>
    </div>
  )
}
