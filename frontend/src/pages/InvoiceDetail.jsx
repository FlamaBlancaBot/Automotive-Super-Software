import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import VehicleHeader from '../components/VehicleHeader'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

function fmt(v) {
  return `£${Number(v || 0).toFixed(2)}`
}

export default function InvoiceDetail({ invoiceId, onBack }) {
  const [status, setStatus] = useState('loading')
  const [invoice, setInvoice] = useState(null)
  const [items, setItems] = useState([])
  const [job, setJob] = useState(null)
  const [error, setError] = useState('')
  const [actionStatus, setActionStatus] = useState('idle')
  const [printStatus, setPrintStatus] = useState('idle')

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet(`/api/invoices/${invoiceId}`)
      const inv = data.invoice
      setInvoice(inv)
      setItems(data.items || [])
      if (inv?.job_id) {
        const jobData = await apiGet(`/api/jobs/${inv.job_id}`).catch(() => null)
        setJob(jobData?.job || null)
      }
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load invoice.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  useEffect(() => {
    if (!invoice) return
    setDocumentTitle(`Invoice ${invoice.invoice_number}`)
  }, [invoice])

  async function printInvoice() {
    setPrintStatus('loading')
    try {
      const out = await apiPost('/api/templates/invoice/render', { invoice_id: invoiceId })
      const html = out.rendered_html || ''
      if (!html) {
        alert('No invoice template found. Set one up in Settings → Templates.')
        return
      }
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;'
      document.body.appendChild(iframe)
      iframe.contentDocument.open()
      iframe.contentDocument.write(html)
      iframe.contentDocument.close()
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }, 3000)
    } catch (err) {
      alert('Print failed: ' + (err.message || 'Unknown error'))
    } finally {
      setPrintStatus('idle')
    }
  }

  async function updateInvoiceStatus(newStatus) {
    if (actionStatus === 'saving') return
    setActionStatus('saving')
    try {
      const out = await apiPatch(`/api/invoices/${invoiceId}`, { status: newStatus })
      if (out?.invoice) setInvoice(out.invoice)
    } finally {
      setActionStatus('idle')
    }
  }

  if (status === 'loading') {
    return <div className="jobsPage"><div className="emptyState">Loading invoice…</div></div>
  }
  if (status === 'error') {
    return <div className="jobsPage"><div className="emptyState">{error}</div></div>
  }
  if (!invoice) {
    return <div className="jobsPage"><div className="emptyState">Invoice not found.</div></div>
  }

  const subtotal = Number(invoice.subtotal_ex_vat || 0)
  const vat = Number(invoice.vat_total || 0)
  const total = Number(invoice.total_inc_vat || 0)
  const customerName = job
    ? `${job.customer_first_name || ''} ${job.customer_surname || ''}`.trim()
    : '—'

  return (
    <div className="jobsPage">
      <header className="pageHeader">
        <div>
          <VehicleHeader
            reg={job?.vehicle_registration || ''}
            make={job?.vehicle_make || ''}
            model={job?.vehicle_model || ''}
            subtitle={invoice.invoice_number}
            reference={`INVOICE #${invoice.id}`}
          />
        </div>
        <div className="pageHeaderActions">
          {onBack && (
            <button type="button" className="secondaryButton" onClick={onBack}>
              Back to Job
            </button>
          )}
          <button
            type="button"
            className="primaryButton"
            onClick={printInvoice}
            disabled={printStatus === 'loading'}
          >
            {printStatus === 'loading' ? 'Loading print…' : 'Print Invoice'}
          </button>
        </div>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">{invoice.invoice_number}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="fieldLabel" style={{ margin: 0 }}>Status</label>
            <select
              className="compactInput"
              value={invoice.status || 'draft'}
              disabled={actionStatus === 'saving'}
              onChange={(e) => updateInvoiceStatus(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
        </div>
        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <div className="fieldLabel">Customer</div>
            <div>{customerName}</div>
          </div>
          <div className="field">
            <div className="fieldLabel">Vehicle</div>
            <div>
              {job?.vehicle_registration ? (
                <span className="mono">{job.vehicle_registration}</span>
              ) : '—'}
              {job?.vehicle_make ? ` ${job.vehicle_make}` : ''}
              {job?.vehicle_model ? ` ${job.vehicle_model}` : ''}
            </div>
          </div>
          <div className="field">
            <div className="fieldLabel">Date</div>
            <div>{formatDateTime(invoice.updated_at || invoice.created_at)}</div>
          </div>
        </div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Line Items</h3>
          <div className="fieldHint">{items.length} item(s)</div>
        </div>
        <div className="quoteTableWrap" style={{ marginTop: 12 }}>
          <table className="quoteTable" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Description</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Unit ex VAT</th>
                <th>Total ex VAT</th>
                <th>Total inc VAT</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? items.map((item) => (
                <tr key={item.id}>
                  <td>{item.description || '—'}</td>
                  <td>{item.item_type || '—'}</td>
                  <td className="mono">{item.quantity}</td>
                  <td className="mono">{fmt(item.unit_price_ex_vat)}</td>
                  <td className="mono">{fmt(item.total_ex_vat)}</td>
                  <td className="mono">{fmt(item.total_inc_vat)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5, padding: '16px 0' }}>
                    No line items — invoice may not be linked to an accepted quote.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Totals</h3>
        </div>
        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <div className="fieldLabel">Subtotal ex VAT</div>
            <div className="mono">{fmt(subtotal)}</div>
          </div>
          <div className="field">
            <div className="fieldLabel">VAT</div>
            <div className="mono">{fmt(vat)}</div>
          </div>
          <div className="field">
            <div className="fieldLabel">Total inc VAT</div>
            <div className="mono" style={{ fontWeight: 800, fontSize: 18 }}>{fmt(total)}</div>
          </div>
        </div>
        {invoice.notes ? (
          <div style={{ marginTop: 12 }}>
            <div className="fieldLabel">Notes</div>
            <div style={{ marginTop: 4 }}>{invoice.notes}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
