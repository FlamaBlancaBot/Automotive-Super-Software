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
    return <div className="documentPage"><div className="emptyState">Loading invoice…</div></div>
  }
  if (status === 'error') {
    return <div className="documentPage"><div className="emptyState">{error}</div></div>
  }
  if (!invoice) {
    return <div className="documentPage"><div className="emptyState">Invoice not found.</div></div>
  }

  const subtotal = Number(invoice.subtotal_ex_vat || 0)
  const vat = Number(invoice.vat_total || 0)
  const total = Number(invoice.total_inc_vat || 0)
  const customerName = job
    ? `${job.customer_first_name || ''} ${job.customer_surname || ''}`.trim()
    : '—'

  return (
    <div className="documentPage">
      <header className="documentHeader noPrint">
        <div className="documentHeaderLeft">
          {onBack && (
            <button type="button" className="documentBackButton" onClick={onBack} title="Back to Job" aria-label="Back to Job">
              ←
            </button>
          )}
          <div>
            <h1 className="documentTitle">Invoice {invoice.invoice_number}</h1>
            <p className="documentSubtitle">Reference: #{invoice.id}</p>
          </div>
        </div>
        <div className="documentHeaderActions">
          <button
            type="button"
            className="primaryButton"
            onClick={printInvoice}
            disabled={printStatus === 'loading'}
          >
            {printStatus === 'loading' ? 'Loading…' : '🖨 Print'}
          </button>
        </div>
      </header>

      <div className="documentControlsSection noPrint">
        <div className="documentStatusControl">
          <label className="fieldLabel">Status:</label>
          <select
            className="compactInput"
            value={invoice.status || 'draft'}
            disabled={actionStatus === 'saving'}
            onChange={(e) => updateInvoiceStatus(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
        </div>
      </div>

      <div className="documentCardContainer">
        <div className="documentCard">
          <div className="documentCardContent">
            {/* Invoice Header */}
            <div className="invoiceHeader">
              <div>
                <h2 className="invoiceTitle">INVOICE</h2>
                <p className="invoiceNumber">{invoice.invoice_number}</p>
              </div>
              <div className="invoiceCompanyInfo">
                <p className="invoiceCompanyName">AUTOSS</p>
                <p className="invoiceCompanyDetails">Service & Repair Garage</p>
              </div>
            </div>

            {/* Customer & Vehicle Info */}
            <div className="invoiceInfoGrid">
              <div className="invoiceInfoSection">
                <p className="invoiceInfoLabel">Bill To:</p>
                <p className="invoiceInfoValue">{customerName}</p>
              </div>
              <div className="invoiceInfoSection">
                <p className="invoiceInfoLabel">Vehicle:</p>
                <p className="invoiceInfoValue">
                  {job?.vehicle_registration || '—'}
                  {job?.vehicle_make ? ` ${job.vehicle_make}` : ''}
                  {job?.vehicle_model ? ` ${job.vehicle_model}` : ''}
                </p>
              </div>
              <div className="invoiceInfoSection">
                <p className="invoiceInfoLabel">Date:</p>
                <p className="invoiceInfoValue">{formatDateTime(invoice.updated_at || invoice.created_at)}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="invoiceLineItems">
              <table className="invoiceTable">
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

            {/* Totals */}
            <div className="invoiceTotals">
              <div className="invoiceTotalRow">
                <span>Subtotal ex VAT:</span>
                <span className="mono">{fmt(subtotal)}</span>
              </div>
              <div className="invoiceTotalRow">
                <span>VAT:</span>
                <span className="mono">{fmt(vat)}</span>
              </div>
              <div className="invoiceTotalRowFinal">
                <span>Total inc VAT:</span>
                <span className="mono">{fmt(total)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes ? (
              <div className="invoiceNotes">
                <p className="invoiceNotesLabel">Notes:</p>
                <p className="invoiceNotesValue">{invoice.notes}</p>
              </div>
            ) : null}

            {/* Footer */}
            <div className="invoiceFooter">
              <p>Thank you for your business.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
