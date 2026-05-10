import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../api/http'
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
  const [payments, setPayments] = useState([])
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const [paymentDraft, setPaymentDraft] = useState({
    amount: '',
    payment_method: 'other',
    payment_type: 'partial',
    paid_at: '',
    payment_reference: '',
    notes: '',
    status: 'recorded',
  })

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet(`/api/invoices/${invoiceId}`)
      const inv = data.invoice
      setInvoice(inv)
      setItems(data.items || [])
      setPayments(data.payments || [])
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

  function openPaymentModal(payment = null) {
    if (!payment) {
      setEditingPaymentId(null)
      setPaymentDraft({
        amount: '',
        payment_method: 'other',
        payment_type: 'partial',
        paid_at: '',
        payment_reference: '',
        notes: '',
        status: 'recorded',
      })
      setPaymentModalOpen(true)
      return
    }
    setEditingPaymentId(payment.id)
    setPaymentDraft({
      amount: String(payment.amount ?? ''),
      payment_method: payment.payment_method || 'other',
      payment_type: payment.payment_type || 'partial',
      paid_at: payment.paid_at ? String(payment.paid_at).slice(0, 16) : '',
      payment_reference: payment.payment_reference || '',
      notes: payment.notes || '',
      status: payment.status || 'recorded',
    })
    setPaymentModalOpen(true)
  }

  async function savePayment() {
    const payload = {
      amount: Number(paymentDraft.amount),
      payment_method: paymentDraft.payment_method,
      payment_type: paymentDraft.payment_type,
      paid_at: paymentDraft.paid_at || null,
      payment_reference: paymentDraft.payment_reference || null,
      notes: paymentDraft.notes || null,
      status: paymentDraft.status,
    }
    if (!Number.isFinite(payload.amount)) return
    setActionStatus('saving')
    try {
      if (editingPaymentId) {
        await apiPatch(`/api/invoices/${invoiceId}/payments/${editingPaymentId}`, payload)
      } else {
        await apiPost(`/api/invoices/${invoiceId}/payments`, payload)
      }
      setPaymentModalOpen(false)
      await load()
    } finally {
      setActionStatus('idle')
    }
  }

  async function deletePayment(paymentId) {
    if (!window.confirm('Delete this payment record?')) return
    setActionStatus('saving')
    try {
      await apiDelete(`/api/invoices/${invoiceId}/payments/${paymentId}`)
      await load()
    } finally {
      setActionStatus('idle')
    }
  }

  async function recalcPaymentStatus() {
    setActionStatus('saving')
    try {
      await apiPost(`/api/invoices/${invoiceId}/recalculate-payment-status`, {})
      await load()
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
  const amountPaid = Number(invoice.amount_paid || 0)
  const balanceDue = Number(invoice.balance_due != null ? invoice.balance_due : Math.max(0, total - amountPaid))
  const paymentStatus = String(invoice.payment_status || 'unpaid')
  const dueDate = invoice.due_date || null
  const customerName = job
    ? `${job.customer_first_name || ''} ${job.customer_surname || ''}`.trim()
    : '—'

  const paymentStatusTone = useMemo(() => {
    if (paymentStatus === 'paid') return 'chipGreen'
    if (paymentStatus === 'partially_paid' || paymentStatus === 'deposit_paid') return 'chipOrange'
    if (paymentStatus === 'overdue') return 'chipRed'
    if (paymentStatus === 'refunded') return 'chipPurple'
    return 'chipGrey'
  }, [paymentStatus])

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
        <div className="documentStatusControl" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
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
          <label className="fieldLabel">Due date:</label>
          <input
            type="datetime-local"
            className="compactInput"
            value={dueDate ? String(dueDate).slice(0, 16) : ''}
            onChange={(e) => apiPatch(`/api/invoices/${invoiceId}`, { due_date: e.target.value || null }).then((out) => setInvoice(out.invoice))}
          />
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
              <div className="invoiceTotalRow">
                <span>Amount paid:</span>
                <span className="mono">{fmt(amountPaid)}</span>
              </div>
              <div className="invoiceTotalRow">
                <span>Balance due:</span>
                <span className="mono">{fmt(balanceDue)}</span>
              </div>
            </div>

            <div className="cardBox noPrint" style={{ marginTop: 14 }}>
              <div className="cardTop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="cardTitle">Payment Tracking</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className={`statusChip ${paymentStatusTone}`}>{paymentStatus}</span>
                  <button type="button" className="miniButton" onClick={recalcPaymentStatus} disabled={actionStatus === 'saving'}>Recalculate</button>
                  <button type="button" className="primaryButton" onClick={() => openPaymentModal()} disabled={actionStatus === 'saving'}>Record Payment</button>
                </div>
              </div>
              <div className="fieldGrid" style={{ marginTop: 10 }}>
                <div className="field"><div className="fieldLabel">Invoice total</div><div>{fmt(total)}</div></div>
                <div className="field"><div className="fieldLabel">Amount paid</div><div>{fmt(amountPaid)}</div></div>
                <div className="field"><div className="fieldLabel">Balance due</div><div>{fmt(balanceDue)}</div></div>
                <div className="field"><div className="fieldLabel">Due date</div><div>{dueDate ? formatDateTime(dueDate) : '—'}</div></div>
              </div>
              {payments.length ? (
                <div className="quoteTableWrap" style={{ marginTop: 10 }}>
                  <table className="quoteTable">
                    <thead><tr><th>Date</th><th>Type</th><th>Method</th><th>Status</th><th>Amount</th><th>Reference</th><th></th></tr></thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td>{formatDateTime(p.paid_at || p.created_at)}</td>
                          <td>{p.payment_type}</td>
                          <td>{p.payment_method}</td>
                          <td>{p.status}</td>
                          <td className="mono">{fmt(p.amount)}</td>
                          <td>{p.payment_reference || '—'}</td>
                          <td>
                            <button type="button" className="miniButton" onClick={() => openPaymentModal(p)}>Edit</button>{' '}
                            <button type="button" className="miniButton" onClick={() => deletePayment(p.id)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="emptyState" style={{ marginTop: 10 }}>No payments recorded yet.</div>}
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

      {paymentModalOpen ? (
        <div className="modalOverlay" onClick={() => setPaymentModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cardTitle">{editingPaymentId ? 'Edit Payment' : 'Record Payment'}</h3>
            <div className="fieldGrid" style={{ marginTop: 10 }}>
              <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Amount</div><input className="input" value={paymentDraft.amount} onChange={(e) => setPaymentDraft((d) => ({ ...d, amount: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Date/time</div><input type="datetime-local" className="input" value={paymentDraft.paid_at} onChange={(e) => setPaymentDraft((d) => ({ ...d, paid_at: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Method</div><select className="select" value={paymentDraft.payment_method} onChange={(e) => setPaymentDraft((d) => ({ ...d, payment_method: e.target.value }))}><option value="cash">cash</option><option value="card_machine">card_machine</option><option value="bank_transfer">bank_transfer</option><option value="online">online</option><option value="cheque">cheque</option><option value="other">other</option></select></div>
              <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Type</div><select className="select" value={paymentDraft.payment_type} onChange={(e) => setPaymentDraft((d) => ({ ...d, payment_type: e.target.value }))}><option value="deposit">deposit</option><option value="partial">partial</option><option value="final">final</option><option value="refund">refund</option><option value="credit">credit</option></select></div>
              <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Status</div><select className="select" value={paymentDraft.status} onChange={(e) => setPaymentDraft((d) => ({ ...d, status: e.target.value }))}><option value="recorded">recorded</option><option value="pending">pending</option><option value="cleared">cleared</option><option value="failed">failed</option><option value="refunded">refunded</option><option value="cancelled">cancelled</option></select></div>
              <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Reference</div><input className="input" value={paymentDraft.payment_reference} onChange={(e) => setPaymentDraft((d) => ({ ...d, payment_reference: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Notes</div><textarea className="textarea" rows={4} value={paymentDraft.notes} onChange={(e) => setPaymentDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
            </div>
            <div className="pageHeaderActions" style={{ marginTop: 10 }}>
              <button type="button" className="secondaryButton" onClick={() => setPaymentModalOpen(false)}>Cancel</button>
              <button type="button" className="primaryButton" onClick={savePayment} disabled={actionStatus === 'saving'}>{actionStatus === 'saving' ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
