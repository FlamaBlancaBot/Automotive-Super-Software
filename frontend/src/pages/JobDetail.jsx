import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
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

export default function JobDetail({ jobId, onBackToJobs, onOpenQuote, onViewPartsOrders, onOpenJobSheet, onOpenInvoice }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [job, setJob] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [partsOrders, setPartsOrders] = useState([])
  const [jobSheet, setJobSheet] = useState(null)
  const [activity, setActivity] = useState([])
  const [invoices, setInvoices] = useState([])
  const [actionStatus, setActionStatus] = useState('idle')

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
      const invoiceRes = await apiGet(`/api/jobs/${jobId}/invoices`).catch(() => ({ invoices: [] }))
      setInvoices(invoiceRes.invoices || [])
      const [sheetRes, activityRes] = await Promise.all([
        apiGet(`/api/jobs/${jobId}/job-sheet`).catch(() => null),
        apiGet(`/api/activity?entity_type=job&entity_id=${jobId}&limit=40`).catch(() => null),
      ])
      setJobSheet(sheetRes || null)
      setActivity((activityRes && activityRes.activity) || [])
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
                <div className="jobDetailValue mono">{job.vehicle_registration}</div>
              </div>
              <div className="jobDetailInfoField">
                <div className="jobDetailLabel">Phone</div>
                <div className="jobDetailValue mono">{job.customer_phone || '—'}</div>
              </div>
            </div>
          </div>

          <div className="jobDetailCard" style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20, color: 'var(--accent)' }}><circle cx="12" cy="12" r="1"></circle><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path><path d="M5 12h14"></path></svg>
              <h2 className="jobDetailCardTitle">Activity Timeline</h2>
            </div>
            <div className="activityTimelineList">
              {activity.length ? activity.map((entry) => (
                <div className="activityTimelineItem" key={entry.id}>
                  <div className="activityTimelineMarker"></div>
                  <div className="activityTimelineContent">
                    <div className="activityTimelineText">{entry.summary}</div>
                    <div className="activityTimelineMeta">{formatDateTime(entry.created_at)} · {entry.user_name || 'SYSTEM'}</div>
                  </div>
                </div>
              )) : (
                <div className="emptyState">No activity yet.</div>
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
              <thead><tr><th>Invoice</th><th>Status</th><th>Subtotal</th><th>Total</th></tr></thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono">{inv.invoice_number}</td>
                    <td>{inv.status}</td>
                    <td>£{Number(inv.subtotal_ex_vat || 0).toFixed(2)}</td>
                    <td>£{Number(inv.total_inc_vat || 0).toFixed(2)}</td>
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

    </div>
  )
}
