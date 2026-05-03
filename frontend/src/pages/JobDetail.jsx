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

export default function JobDetail({ jobId, onBackToJobs, onOpenQuote, onViewPartsOrders, onOpenJobSheet }) {
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
        await load()
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
      <header className="pageHeader">
        <div>
          <VehicleHeader
            reg={job.vehicle_registration}
            make={job.vehicle_make}
            model={job.vehicle_model}
            subtitle={job.title}
            reference={`JOB #${job.id}`}
          />
        </div>
        <div className="pageHeaderActions">
          <button type="button" className="secondaryButton" onClick={onBackToJobs}>
            Back to Jobs
          </button>
          <button
            type="button"
            className="primaryButton"
            onClick={createOrOpenQuote}
            disabled={actionStatus === 'saving'}
          >
            {actionStatus === 'saving' ? 'Working…' : 'Create/Open quote'}
          </button>
          <button type="button" className="secondaryButton" onClick={createOrOpenInvoice}>
            Create/Open invoice
          </button>
        </div>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Vehicle</h3>
          <div className="fieldHint">
            {job.vehicle_make || '—'} {job.vehicle_model || ''}
          </div>
        </div>
        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <div className="fieldLabel">REG</div>
            <div className="mono">{job.vehicle_registration}</div>
          </div>
          <div className="field">
            <div className="fieldLabel">Service</div>
            <div>{job.service_template_name}</div>
          </div>
          <div className="field">
            <div className="fieldLabel">Status</div>
            <div><StatusChip label={job.status} tone="chipGrey" /></div>
          </div>
          <div className="field">
            <div className="fieldLabel">Priority</div>
            <div>{job.priority}</div>
          </div>
        </div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Customer</h3>
          <div className="fieldHint">
            {job.customer_first_name} {job.customer_surname}
          </div>
        </div>
        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <div className="fieldLabel">Phone</div>
            <div className="mono">{job.customer_phone || '—'}</div>
          </div>
          <div className="field">
            <div className="fieldLabel">Booked start</div>
            <div>{formatDateTime(job.booked_start)}</div>
          </div>
          <div className="field">
            <div className="fieldLabel">Booked end</div>
            <div>{formatDateTime(job.booked_end)}</div>
          </div>
        </div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Notes</h3>
          <div className="fieldHint">Saved from intake (if provided).</div>
        </div>

        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">What the customer said</div>
            <textarea className="textarea" value={job.notes_customer_words || ''} readOnly />
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Office notes</div>
            <textarea className="textarea" value={job.notes_internal || ''} readOnly />
          </div>
        </div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Quotes</h3>
          <div className="fieldHint">{quotes.length} linked quote(s)</div>
        </div>

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

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Job Sheet</h3>
          <button type="button" className="secondaryButton noPrint" onClick={() => onOpenJobSheet && onOpenJobSheet(job.id)}>
            View job sheet
          </button>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 8 }}>
          <button type="button" className="secondaryButton noPrint" onClick={() => onOpenJobSheet && onOpenJobSheet(job.id)}>View job sheet</button>
          <button type="button" className="secondaryButton noPrint" onClick={() => window.print()}>Print job sheet</button>
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

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Invoices</h3>
          <div className="fieldHint">{invoices.length} invoice(s)</div>
        </div>
        {invoices.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 10 }}>
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
        ) : <div className="emptyState" style={{ marginTop: 10 }}>No invoice yet.</div>}
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Parts orders</h3>
          <div className="fieldHint">{partsOrders.length} part(s) tracked</div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              if (typeof onViewPartsOrders === 'function') onViewPartsOrders(job.id)
            }}
          >
            View parts orders
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

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Activity</h3>
          <div className="fieldHint">{activity.length} entries</div>
        </div>
        {activity.length ? (
          <div className="activityList">
            {activity.map((entry) => (
              <div className="activityItem" key={entry.id}>
                <div className="tinyMeta">{formatDateTime(entry.created_at)}</div>
                <div className="activityMain">{entry.summary}</div>
                <div className="fieldHint">
                  {(entry.user_name || 'SYSTEM')} · {entry.action}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>No activity yet.</div>
        )}
      </div>
    </div>
  )
}
