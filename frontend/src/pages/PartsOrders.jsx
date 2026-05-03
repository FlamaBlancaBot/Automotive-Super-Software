import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { partsOrderTone } from '../utils/statusChips'
import VehicleHeader from '../components/VehicleHeader'
import StatusChip from '../components/StatusChip'

function formatMoney(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '£0.00'
  return `£${n.toFixed(2)}`
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

function parseQuery(locationPath) {
  const q = String(locationPath || '').split('?')[1] || ''
  const params = new URLSearchParams(q)
  return {
    jobId: Number(params.get('job_id') || 0) || 0,
    quoteId: Number(params.get('quote_id') || 0) || 0,
    status: String(params.get('status') || '').trim(),
    q: String(params.get('q') || '').trim(),
    due: String(params.get('due') || '').trim(),
  }
}

export default function PartsOrders({ locationPath }) {
  const query = useMemo(() => parseQuery(locationPath), [locationPath])

  const [summary, setSummary] = useState(null)
  const [suppliers, setSuppliers] = useState([])

  const [filters, setFilters] = useState(() => ({
    q: query.q,
    status: query.status,
    supplier_id: '',
    due: query.due,
  }))

  const [listStatus, setListStatus] = useState('idle')
  const [listError, setListError] = useState('')
  const [orders, setOrders] = useState([])
  const [expandedJobs, setExpandedJobs] = useState({})

  const [goodsModal, setGoodsModal] = useState(null) // { order }
  const [editModal, setEditModal] = useState(null) // { orderId }
  const [addReceivedModal, setAddReceivedModal] = useState(false)
  const [returnModal, setReturnModal] = useState(false)
  const [modalStatus, setModalStatus] = useState('idle')
  const [modalError, setModalError] = useState('')

  useEffect(() => {
    setDocumentTitle('Parts')
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [summaryRes, supplierRes] = await Promise.all([
          apiGet('/api/dashboard/summary').catch(() => ({ summary: null })),
          apiGet('/api/suppliers').catch(() => ({ suppliers: [] })),
        ])
        if (cancelled) return
        setSummary(summaryRes.summary || null)
        setSuppliers(supplierRes.suppliers || [])
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadOrders() {
    setListStatus('loading')
    setListError('')
    try {
      const params = new URLSearchParams()
      if (filters.q.trim()) params.set('q', filters.q.trim())
      if (filters.status) params.set('status', filters.status)
      if (filters.supplier_id) params.set('supplier_id', filters.supplier_id)
      if (filters.due) params.set('due', filters.due)
      if (query.jobId) params.set('job_id', String(query.jobId))
      if (query.quoteId) params.set('quote_id', String(query.quoteId))

      const data = await apiGet(`/api/parts-orders?${params.toString()}`)
      setOrders(data.parts_orders || [])
      setListStatus('ready')
    } catch (err) {
      setListStatus('error')
      setListError(err.message || 'Failed to load parts orders.')
    }
  }

  useEffect(() => {
    loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.jobId, query.quoteId])

  async function setStatus(orderId, status) {
    setModalStatus('saving')
    setModalError('')
    try {
      await apiPatch(`/api/parts-orders/${orderId}/status`, { status })
      await loadOrders()
      setModalStatus('idle')
    } catch (err) {
      setModalStatus('error')
      setModalError(err.message || 'Failed to update status.')
    }
  }

  const groupedByJob = useMemo(() => {
    const map = new Map()
    for (const o of orders || []) {
      const key = Number(o.job_id || 0) || `no-job-${o.id}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          job_id: o.job_id || null,
          reg: o.vehicle_registration || '—',
          make: o.vehicle_make || '',
          model: o.vehicle_model || '',
          job_title: o.job_title || 'JOB',
          job_status: o.job_status || '—',
          rows: [],
        })
      }
      map.get(key).rows.push(o)
    }
    return [...map.values()]
  }, [orders])

  return (
    <div className="partsPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Parts Orders</h2>
          <p className="pageSubtitle">
            Track ordered parts, goods received, and returns/credits (database-backed).
          </p>
        </div>
        <span className="setupPill" title="Database-backed">
          Live
        </span>
      </header>

      <section className="cards partsCards">
        <SummaryCard title="Pending" value={summary ? summary.parts_to_order : '—'} />
        <SummaryCard title="Ordered" value={summary ? summary.parts_ordered : '—'} />
        <SummaryCard title="Expected today" value={summary ? summary.parts_expected_today : '—'} />
        <SummaryCard title="Overdue" value={summary ? summary.parts_overdue : '—'} />
        <SummaryCard title="Goods received today" value={summary ? summary.goods_received_today : '—'} />
        <SummaryCard title="Returns/credits" value={summary ? summary.returns_pending : '—'} />
      </section>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Filters</h3>
          <div className="fieldHint">Search by REG, part, supplier, brand, part number.</div>
        </div>

        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Search</div>
            <input
              className="input"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder="e.g. AB12 CDE, pads, ECP"
            />
          </div>

          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Status</div>
            <select
              className="select"
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">Any</option>
              <option value="pending">Pending</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="return_required">Return required</option>
              <option value="returned">Returned</option>
              <option value="credit_pending">Credit pending</option>
              <option value="credited">Credited</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Supplier</div>
            <select
              className="select"
              value={filters.supplier_id}
              onChange={(e) => setFilters((f) => ({ ...f, supplier_id: e.target.value }))}
            >
              <option value="">Any</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Due</div>
            <select
              className="select"
              value={filters.due}
              onChange={(e) => setFilters((f) => ({ ...f, due: e.target.value }))}
            >
              <option value="">Any</option>
              <option value="today">Today</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <button type="button" className="secondaryButton" onClick={loadOrders}>
            {listStatus === 'loading' ? 'Loading…' : 'Apply filters'}
          </button>
          <button type="button" className="secondaryButton" onClick={() => setAddReceivedModal(true)}>Add received part</button>
          <button type="button" className="secondaryButton" onClick={() => setReturnModal(true)}>Return part</button>
          {modalStatus === 'saving' ? <span className="fieldHint">Saving…</span> : null}
        </div>

        {listError ? <div className="notice bad">{listError}</div> : null}
        {modalError ? <div className="notice bad">{modalError}</div> : null}
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Jobs / REG Groups</h3>
          <div className="fieldHint">{groupedByJob.length} job group(s)</div>
        </div>

        {groupedByJob.length ? (
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {groupedByJob.map((group) => {
              const pending = group.rows.filter((r) => r.status === 'pending').length
              const ordered = group.rows.filter((r) => r.status === 'ordered').length
              const received = group.rows.filter((r) => r.status === 'received').length
              const returns = group.rows.filter((r) => String(r.status || '').includes('return') || String(r.status || '').includes('credit')).length
              const expanded = Boolean(expandedJobs[group.key])
              return (
                <article key={group.key} className="cardBox">
                  <div className="cardTop">
                    <div>
                      <VehicleHeader small reg={group.reg} make={group.make} model={group.model} />
                      <div className="fieldHint">{group.job_title} · {group.job_status}</div>
                    </div>
                    <div className="fieldHint">Pending {pending} · Ordered {ordered} · Received {received} · Returns {returns}</div>
                  </div>
                  <div className="pageHeaderActions" style={{ marginTop: 10 }}>
                    <button type="button" className="miniButton" onClick={() => setExpandedJobs((s) => ({ ...s, [group.key]: !expanded }))}>
                      {expanded ? 'Hide parts' : 'View parts'}
                    </button>
                  </div>
                  {expanded ? (
                    <div className="quoteTableWrap" style={{ marginTop: 10 }}>
                      <table className="quoteTable" style={{ minWidth: 900 }}>
                        <thead><tr><th>Part</th><th>Supplier</th><th>ETA</th><th>Status</th><th>Invoice/Note</th><th></th></tr></thead>
                        <tbody>
                          {group.rows.map((o) => (
                            <tr key={o.id}>
                              <td>{o.part_name || o.description || '—'}</td>
                              <td>{o.supplier_name || '—'}</td>
                              <td>{o.eta_text || formatDate(o.expected_at || o.eta_datetime)}</td>
                              <td><StatusChip label={o.status} tone={partsOrderTone(o.status)} /></td>
                              <td className="mono">{o.supplier_invoice_number || o.delivery_note_number || '—'}</td>
                              <td>
                                <div className="rowActions">
                                  <button type="button" className="miniButton primary" onClick={() => setGoodsModal({ order: o })}>Goods received</button>
                                  <button type="button" className="miniButton" onClick={() => setEditModal({ orderId: o.id })}>View/edit</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            No parts orders found.
          </div>
        )}
      </div>

      {goodsModal ? (
        <GoodsReceivedModal
          order={goodsModal.order}
          onClose={() => setGoodsModal(null)}
          onSaved={() => {
            setGoodsModal(null)
            loadOrders()
          }}
        />
      ) : null}

      {editModal ? (
        <EditPartsOrderModal
          orderId={editModal.orderId}
          suppliers={suppliers}
          onClose={() => setEditModal(null)}
          onSaved={() => {
            setEditModal(null)
            loadOrders()
          }}
        />
      ) : null}
      {addReceivedModal ? <AddReceivedPartModal onClose={() => setAddReceivedModal(false)} onSaved={() => { setAddReceivedModal(false); loadOrders() }} /> : null}
      {returnModal ? <ReturnPartModal onClose={() => setReturnModal(false)} onSaved={() => { setReturnModal(false); loadOrders() }} /> : null}
    </div>
  )
}

function SummaryCard({ title, value }) {
  return (
    <article className="cardBox">
      <div className="cardTop">
        <h3 className="cardTitle">{title}</h3>
        <span className="cardValue">{value == null ? '—' : String(value)}</span>
      </div>
    </article>
  )
}

function AddReceivedPartModal({ onClose, onSaved }) {
  const [jobs, setJobs] = useState([])
  const [reg, setReg] = useState('')
  const [jobId, setJobId] = useState('')
  const [form, setForm] = useState({ part_name: '', part_number: '', brand: '', supplier: '', quantity: '1', invoice: '', delivery: '', cost: '0', markup: '0', sell: '0', notes: '' })
  const [status, setStatus] = useState('idle')
  async function lookup() {
    const out = await apiGet(`/api/jobs?q=${encodeURIComponent(reg)}`)
    setJobs(out.jobs || [])
    if (out.jobs?.[0]?.id) setJobId(String(out.jobs[0].id))
  }
  async function save() {
    if (!jobId || !form.part_name.trim()) return
    setStatus('saving')
    const supplierId = 0
    const created = await apiPost('/api/parts-orders', {
      job_id: Number(jobId),
      part_name: form.part_name,
      part_number: form.part_number,
      brand: form.brand,
      quantity: Number(form.quantity || 1),
      cost_ex_vat: Number(form.cost || 0),
      sell_ex_vat: Number(form.sell || 0),
      notes: form.notes,
      supplier_id: supplierId || null,
    })
    const order = created.parts_order
    await apiPost(`/api/parts-orders/${order.id}/goods-received`, {
      quantity_received: Number(form.quantity || 1),
      supplier_invoice_number: form.invoice || null,
      delivery_note_number: form.delivery || null,
      notes: form.notes || null,
      correct_part: 1,
      condition_ok: 1,
      return_required: 0,
    })
    setStatus('idle')
    onSaved()
  }
  return (
    <div className="modalOverlay" onClick={onClose}><div className="modalCard" onClick={(e) => e.stopPropagation()}>
      <h3>Add received part</h3>
      <input className="input" placeholder="REG" value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} />
      <button type="button" className="miniButton" onClick={lookup}>Lookup REG</button>
      <select className="select" value={jobId} onChange={(e) => setJobId(e.target.value)}><option value="">Select job</option>{jobs.map((j) => <option key={j.id} value={j.id}>{j.vehicle_registration} · {j.title}</option>)}</select>
      <input className="input" placeholder="PART NAME" value={form.part_name} onChange={(e) => setForm((f) => ({ ...f, part_name: e.target.value.toUpperCase() }))} />
      <div className="fieldGrid"><input className="input" placeholder="PART NO." value={form.part_number} onChange={(e) => setForm((f) => ({ ...f, part_number: e.target.value.toUpperCase() }))} /><input className="input" placeholder="BRAND" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value.toUpperCase() }))} /></div>
      <div className="fieldGrid"><input className="input" placeholder="QTY" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} /><input className="input" placeholder="INVOICE NO." value={form.invoice} onChange={(e) => setForm((f) => ({ ...f, invoice: e.target.value.toUpperCase() }))} /></div>
      <div className="fieldGrid"><input className="input" placeholder="COST EX VAT" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} /><input className="input" placeholder="SELL EX VAT" value={form.sell} onChange={(e) => setForm((f) => ({ ...f, sell: e.target.value }))} /></div>
      <textarea className="textarea" placeholder="NOTES" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value.toUpperCase() }))} />
      <div className="pageHeaderActions"><button type="button" className="secondaryButton" onClick={onClose}>Cancel</button><button type="button" className="primaryButton" onClick={save}>{status === 'saving' ? 'Saving…' : 'Save received part'}</button></div>
    </div></div>
  )
}

function ReturnPartModal({ onClose, onSaved }) {
  const [reg, setReg] = useState('')
  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [credit, setCredit] = useState('')
  async function lookup() {
    const out = await apiGet(`/api/parts-orders?q=${encodeURIComponent(reg)}`)
    setOrders(out.parts_orders || [])
    if (out.parts_orders?.[0]?.id) setOrderId(String(out.parts_orders[0].id))
  }
  async function save(nextStatus = 'return_required') {
    if (!orderId) return
    await apiPatch(`/api/parts-orders/${orderId}`, { credit_note_number: credit || null, notes: reason || null })
    await apiPatch(`/api/parts-orders/${orderId}/status`, { status: nextStatus, notes: reason || null })
    onSaved()
  }
  return (
    <div className="modalOverlay" onClick={onClose}><div className="modalCard" onClick={(e) => e.stopPropagation()}>
      <h3>Return part</h3>
      <input className="input" placeholder="REG" value={reg} onChange={(e) => setReg(e.target.value.toUpperCase())} />
      <button type="button" className="miniButton" onClick={lookup}>Lookup REG</button>
      <select className="select" value={orderId} onChange={(e) => setOrderId(e.target.value)}><option value="">Select part</option>{orders.map((o) => <option key={o.id} value={o.id}>{o.vehicle_registration} · {o.part_name || o.description}</option>)}</select>
      <textarea className="textarea" placeholder="RETURN REASON" value={reason} onChange={(e) => setReason(e.target.value.toUpperCase())} />
      <input className="input" placeholder="CREDIT NOTE NUMBER" value={credit} onChange={(e) => setCredit(e.target.value.toUpperCase())} />
      <div className="pageHeaderActions"><button type="button" className="secondaryButton" onClick={onClose}>Cancel</button><button type="button" className="miniButton" onClick={() => save('return_required')}>Mark return required</button><button type="button" className="miniButton" onClick={() => save('credit_pending')}>Mark credit pending</button><button type="button" className="primaryButton" onClick={() => save('credited')}>Mark credited</button></div>
    </div></div>
  )
}

function GoodsReceivedModal({ order, onClose, onSaved }) {
  const [qty, setQty] = useState('1')
  const [invoice, setInvoice] = useState('')
  const [delivery, setDelivery] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [correctPart, setCorrectPart] = useState(true)
  const [conditionOk, setConditionOk] = useState(true)
  const [returnRequired, setReturnRequired] = useState(false)
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function save() {
    setStatus('saving')
    setError('')
    try {
      await apiPost(`/api/parts-orders/${order.id}/goods-received`, {
        quantity_received: Number(qty || 0) || 1,
        supplier_invoice_number: invoice.trim() || null,
        delivery_note_number: delivery.trim() || null,
        received_by: receivedBy.trim() || null,
        correct_part: correctPart ? 1 : 0,
        condition_ok: conditionOk ? 1 : 0,
        return_required: returnRequired ? 1 : 0,
        notes: notes.trim() || null,
      })
      setStatus('idle')
      onSaved()
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to save goods received.')
    }
  }

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalTop">
          <div>
            <div style={{ fontWeight: 950 }}>Goods received</div>
            <div className="fieldHint">
              {order.vehicle_registration || 'REG'} — {order.part_name || order.description || 'Part'}
            </div>
          </div>
          <button type="button" className="miniButton" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Quantity received</div>
            <input className="input" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Invoice no.</div>
            <input className="input" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Delivery note</div>
            <input className="input" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Received by</div>
            <input className="input" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Checks</div>
            <label className="inlineCheck" style={{ marginRight: 12 }}>
              <input type="checkbox" checked={correctPart} onChange={(e) => setCorrectPart(e.target.checked)} />
              <span>Correct part</span>
            </label>
            <label className="inlineCheck" style={{ marginRight: 12 }}>
              <input type="checkbox" checked={conditionOk} onChange={(e) => setConditionOk(e.target.checked)} />
              <span>Condition OK</span>
            </label>
            <label className="inlineCheck">
              <input type="checkbox" checked={returnRequired} onChange={(e) => setReturnRequired(e.target.checked)} />
              <span>Return required</span>
            </label>
          </div>
          <div className="field" style={{ gridColumn: 'span 12' }}>
            <div className="fieldLabel">Notes</div>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        {error ? <div className="notice bad">{error}</div> : null}

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <button type="button" className="primaryButton" disabled={status === 'saving'} onClick={save}>
            {status === 'saving' ? 'Saving…' : 'Save goods received'}
          </button>
          <button type="button" className="secondaryButton" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function EditPartsOrderModal({ orderId, suppliers, onClose, onSaved }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)

  const [invoice, setInvoice] = useState('')
  const [delivery, setDelivery] = useState('')
  const [expectedAt, setExpectedAt] = useState('')
  const [etaText, setEtaText] = useState('')
  const [brand, setBrand] = useState('')
  const [partNumber, setPartNumber] = useState('')
  const [cost, setCost] = useState('')
  const [sell, setSell] = useState('')
  const [notes, setNotes] = useState('')

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet(`/api/parts-orders/${orderId}`)
      const po = data.parts_order
      setOrder(po)
      setInvoice(po.supplier_invoice_number || '')
      setDelivery(po.delivery_note_number || '')
      setExpectedAt(po.expected_at || '')
      setEtaText(po.eta_text || '')
      setBrand(po.brand || '')
      setPartNumber(po.part_number || '')
      setCost(String(po.cost_ex_vat || ''))
      setSell(String(po.sell_ex_vat || ''))
      setNotes(po.notes || '')
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load parts order.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  async function save() {
    if (!order) return
    setStatus('saving')
    setError('')
    try {
      await apiPatch(`/api/parts-orders/${order.id}`, {
        supplier_invoice_number: invoice.trim() || null,
        delivery_note_number: delivery.trim() || null,
        expected_at: expectedAt.trim() || null,
        eta_text: etaText.trim() || null,
        notes: notes.trim() || null,
        brand: brand.trim() || null,
        part_number: partNumber.trim() || null,
        cost_ex_vat: cost === '' ? null : Number(cost),
        sell_ex_vat: sell === '' ? null : Number(sell),
      })
      setStatus('idle')
      onSaved()
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to save changes.')
    }
  }

  async function setOrderStatus(nextStatus) {
    if (!order) return
    setStatus('saving')
    setError('')
    try {
      await apiPatch(`/api/parts-orders/${order.id}/status`, { status: nextStatus })
      await load()
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to update status.')
    }
  }

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modalTop">
          <div>
            <div style={{ fontWeight: 950 }}>View/edit parts order</div>
            <div className="fieldHint">
              Order #{orderId}
            </div>
          </div>
          <button type="button" className="miniButton" onClick={onClose}>
            ✕
          </button>
        </div>

        {status === 'loading' ? (
          <div className="emptyState" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : error ? (
          <div className="notice bad">{error}</div>
        ) : order ? (
          <>
            <div className="fieldGrid" style={{ marginTop: 12 }}>
              <div className="field" style={{ gridColumn: 'span 12' }}>
                <div className="fieldLabel">Status</div>
                <div className="pageHeaderActions" style={{ marginTop: 8 }}>
                  <StatusChip label={order.status} tone={partsOrderTone(order.status)} />
                  <select className="select" value={order.status} onChange={(e) => setOrderStatus(e.target.value)}>
                    <option value="pending">pending</option>
                    <option value="ordered">ordered</option>
                    <option value="received">received</option>
                    <option value="return_required">return_required</option>
                    <option value="returned">returned</option>
                    <option value="credit_pending">credit_pending</option>
                    <option value="credited">credited</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">Invoice no.</div>
                <input className="input" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">Delivery note</div>
                <input className="input" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">Expected at (DATETIME)</div>
                <input className="input" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} placeholder="YYYY-MM-DD HH:MM:SS" />
              </div>
              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">ETA text</div>
                <input className="input" value={etaText} onChange={(e) => setEtaText(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">Brand</div>
                <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">Part number</div>
                <input className="input" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} />
              </div>
              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">Cost ex VAT</div>
                <input className="input" value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" />
              </div>
              <div className="field" style={{ gridColumn: 'span 6' }}>
                <div className="fieldLabel">Sell ex VAT</div>
                <input className="input" value={sell} onChange={(e) => setSell(e.target.value)} inputMode="decimal" />
              </div>
              <div className="field" style={{ gridColumn: 'span 12' }}>
                <div className="fieldLabel">Notes</div>
                <textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="pageHeaderActions" style={{ marginTop: 12 }}>
              <button type="button" className="primaryButton" disabled={status === 'saving'} onClick={save}>
                {status === 'saving' ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="secondaryButton" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
