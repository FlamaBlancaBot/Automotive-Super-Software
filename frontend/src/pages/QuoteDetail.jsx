import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { toOperationalUpper } from '../utils/text'
import VehicleHeader from '../components/VehicleHeader'
import StatusChip from '../components/StatusChip'
import MoneyDisplay from '../components/MoneyDisplay'

const QUOTE_STATUSES = ['draft', 'ready', 'sent', 'accepted', 'rejected', 'completed']
const PART_TYPES = ['part', 'oil', 'service_item', 'mot_repair', 'other']
const LABOUR_TYPES = ['labour', 'diagnostic']

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round2(value) {
  return Math.round(toNumber(value, 0) * 100) / 100
}

function formatMoney(value) {
  return `£${toNumber(value, 0).toFixed(2)}`
}

function optionPriceFrom(costPrice, markupPercent) {
  return round2(toNumber(costPrice, 0) * (1 + toNumber(markupPercent, 0) / 100))
}

function optionMarkupFrom(costPrice, sellPrice) {
  const cost = toNumber(costPrice, 0)
  if (!cost) return 0
  return round2(((toNumber(sellPrice, 0) / cost) - 1) * 100)
}

function getEffectiveOption(item) {
  const options = Array.isArray(item?.supplier_options) ? item.supplier_options : []
  const selected = options.find((o) => Number(o.is_selected) === 1 && Number(o.is_available) !== 0)
  if (selected) return selected
  const valid = options.filter((o) => Number(o.is_available) !== 0)
  if (!valid.length) return null
  return [...valid].sort((a, b) => toNumber(a.sell_price, 0) - toNumber(b.sell_price, 0))[0]
}

function getCheapestSupplierId(item) {
  const options = Array.isArray(item?.supplier_options) ? item.supplier_options : []
  const valid = options.filter((o) => Number(o.is_available) !== 0)
  if (!valid.length) return null
  return valid.sort((a, b) => toNumber(a.sell_price, 0) - toNumber(b.sell_price, 0))[0].supplier_id
}

export default function QuoteDetail({ quoteId, onBackToQuotes, onViewPartsOrders }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveState, setSaveState] = useState('saved')

  const [quote, setQuote] = useState(null)
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [predefined, setPredefined] = useState([])
  const [partsOrders, setPartsOrders] = useState([])
  const [activity, setActivity] = useState([])
  const [showCustomerQuote, setShowCustomerQuote] = useState(false)
  const [renderedCustomerQuoteHtml, setRenderedCustomerQuoteHtml] = useState('')
  const [customerDetailLink, setCustomerDetailLink] = useState('')

  const [quoteDraft, setQuoteDraft] = useState({ title: '', internal_notes: '', customer_notes: '' })
  const [expandedRows, setExpandedRows] = useState({})
  const [supplierToAdd, setSupplierToAdd] = useState('')
  const [customSupplierName, setCustomSupplierName] = useState('')

  const partItems = useMemo(() => (items || []).filter((i) => PART_TYPES.includes(String(i.item_type || ''))), [items])
  const labourItems = useMemo(() => (items || []).filter((i) => LABOUR_TYPES.includes(String(i.item_type || ''))), [items])
  const quoteSupplierIds = useMemo(() => {
    const ids = new Set()
    for (const item of partItems) {
      for (const option of item.supplier_options || []) ids.add(Number(option.supplier_id || 0))
    }
    return [...ids].filter((x) => x > 0)
  }, [partItems])
  const quoteSuppliers = useMemo(
    () => (suppliers || []).filter((s) => quoteSupplierIds.includes(Number(s.id))),
    [suppliers, quoteSupplierIds],
  )

  const totalsView = useMemo(() => {
    const vatDefault = toNumber(quote?.vat_rate, 0.2)
    let costEx = 0
    let sellEx = 0
    let vat = 0
    let lines = 0
    let labourEx = 0
    let consumablesEx = 0
    let partsEx = 0

    for (const item of items || []) {
      if (Number(item.selected_for_quote) !== 1) continue
      lines += 1
      const qty = toNumber(item.quantity, 1)
      const vatRate = toNumber(item.vat_rate, vatDefault)

      if (PART_TYPES.includes(String(item.item_type || ''))) {
        const opt = getEffectiveOption(item)
        const cost = opt ? toNumber(opt.cost_price, item.unit_cost) : toNumber(item.unit_cost, 0)
        const sell = opt ? toNumber(opt.sell_price, item.unit_sell) : toNumber(item.unit_sell, 0)
        costEx += qty * cost
        sellEx += qty * sell
        partsEx += qty * sell
        vat += qty * sell * vatRate
      } else {
        const cost = toNumber(item.unit_cost, 0)
        const sell = toNumber(item.unit_sell, 0)
        costEx += qty * cost
        sellEx += qty * sell
        if (String(item.item_type || '') === 'labour') labourEx += qty * sell
        else consumablesEx += qty * sell
        vat += qty * sell * vatRate
      }
    }

    const sellInc = sellEx + vat
    return {
      lines,
      costEx: round2(costEx),
      sellEx: round2(sellEx),
      vat: round2(vat),
      sellInc: round2(sellInc),
      margin: round2(sellEx - costEx),
      labourEx: round2(labourEx),
      consumablesEx: round2(consumablesEx),
      partsEx: round2(partsEx),
    }
  }, [items, quote])

  useEffect(() => {
    setDocumentTitle('Quote')
  }, [])

  useEffect(() => {
    if (!quote) return
    setDocumentTitle(`${quote.quote_number || 'Quote'} - ${quote.vehicle_registration || 'REG'}`)
  }, [quote])

  async function load(opts = {}) {
    const preserveScroll = Boolean(opts.preserveScroll)
    const keepStatus = Boolean(opts.keepStatus)
    const scrollY = preserveScroll ? window.scrollY : 0
    if (!keepStatus) setStatus('loading')
    setError('')
    try {
      const [q, s, p, po] = await Promise.all([
        apiGet(`/api/quotes/${quoteId}`),
        apiGet('/api/suppliers').catch(() => ({ suppliers: [] })),
        apiGet('/api/predefined-quote-items').catch(() => ({ items: [] })),
        apiGet(`/api/parts-orders?quote_id=${quoteId}`).catch(() => ({ parts_orders: [] })),
      ])
      setQuote(q.quote || null)
      setItems(q.items || [])
      setQuoteDraft({
        title: q.quote?.title || '',
        internal_notes: q.quote?.internal_notes || '',
        customer_notes: q.quote?.customer_notes || '',
      })
      setSaveState('saved')
      setSuppliers(s.suppliers || [])
      setPredefined(p.items || [])
      setPartsOrders(po.parts_orders || [])
      const activityRes = await apiGet(`/api/activity?entity_type=quote&entity_id=${quoteId}&limit=40`).catch(() => null)
      setActivity((activityRes && activityRes.activity) || [])
      if (!keepStatus) setStatus('ready')
      if (preserveScroll) {
        window.requestAnimationFrame(() => window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' }))
      }
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load quote.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId])

  async function saveQuoteMeta() {
    setSaveBusy(true)
    setSaveState('saving')
    setError('')
    try {
      const out = await apiPatch(`/api/quotes/${quoteId}`, quoteDraft)
      setQuote(out.quote)
      setNotice('Quote details saved.')
      setSaveState('saved')
    } catch (err) {
      setError(err.message || 'Failed to save quote details.')
      setSaveState('failed')
    } finally {
      setSaveBusy(false)
    }
  }

  async function setQuoteStatus(nextStatus) {
    if (!QUOTE_STATUSES.includes(nextStatus)) return
    setSaveBusy(true)
    setSaveState('saving')
    setError('')
    setNotice('')
    try {
      const out = await apiPatch(`/api/quotes/${quoteId}/status`, { status: nextStatus })
      setQuote((prev) => ({ ...prev, status: out.quote?.status || nextStatus }))
      if (nextStatus === 'accepted') {
        setNotice(`Quote accepted. ${Number(out.parts_orders_created || 0)} parts order(s) created.`)
      }
      await load({ preserveScroll: true, keepStatus: true })
      setSaveState('saved')
    } catch (err) {
      setError(err.message || 'Failed to update quote status.')
      setSaveState('failed')
    } finally {
      setSaveBusy(false)
    }
  }

  async function addLine(itemType, description) {
    setSaveBusy(true)
    setError('')
    try {
      await apiPost(`/api/quotes/${quoteId}/items`, {
        item_type: itemType,
        description,
        quantity: 1,
        unit_cost: 0,
        unit_sell: 0,
        vat_rate: toNumber(quote?.vat_rate, 0.2),
        selected_for_quote: 1,
      })
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to add line.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function createCustomerDetailsRequest() {
    try {
      const out = await apiPost('/api/customer-detail-requests', {
        customer_id: quote.customer_id,
        quote_id: quote.id,
        job_id: quote.job_id || null,
        base_url: window.location.origin,
        requested_fields: ['email', 'postcode', 'address'],
      })
      if (out?.preview_url) {
        setCustomerDetailLink(out.preview_url)
        setNotice('Customer details request link created (SMS webhook can be connected later).')
      }
    } catch (err) {
      setError(err.message || 'Failed to create customer details request link.')
    }
  }

  async function loadCustomerQuotePreview() {
    try {
      const out = await apiPost('/api/templates/customer_quote/render', { quote_id: quoteId })
      setRenderedCustomerQuoteHtml(out.rendered_html || '')
    } catch (err) {
      setError(err.message || 'Failed to render customer quote preview.')
    }
  }

  async function addPredefined(id) {
    const item = (predefined || []).find((x) => Number(x.id) === Number(id))
    if (!item) return
    await addLine(item.item_type || 'other', item.name || 'PREDEFINED ITEM')
  }

  async function patchItem(itemId, patch) {
    const item = (items || []).find((x) => Number(x.id) === Number(itemId))
    if (!item) return
    setSaveBusy(true)
    setError('')
    try {
      const payload = {
        item_type: patch.item_type ?? item.item_type,
        description: patch.description ?? item.description,
        quantity: patch.quantity ?? item.quantity,
        unit_cost: patch.unit_cost ?? item.unit_cost,
        unit_sell: patch.unit_sell ?? item.unit_sell,
        markup_percent: patch.markup_percent ?? item.markup_percent,
        vat_rate: patch.vat_rate ?? item.vat_rate,
        eta_text: patch.eta_text ?? item.eta_text,
        supplier_id: patch.supplier_id ?? item.supplier_id,
        part_brand: patch.part_brand ?? item.part_brand,
        part_number: patch.part_number ?? item.part_number,
        selected_for_quote: patch.selected_for_quote ?? item.selected_for_quote,
      }
      await apiPatch(`/api/quotes/${quoteId}/items/${itemId}`, payload)
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to update line.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function removeItem(itemId) {
    if (!window.confirm('Remove this line?')) return
    setSaveBusy(true)
    try {
      await apiDelete(`/api/quotes/${quoteId}/items/${itemId}`)
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to remove line.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function duplicateItem(item) {
    setSaveBusy(true)
    try {
      await apiPost(`/api/quotes/${quoteId}/items`, {
        item_type: item.item_type,
        description: item.description,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        unit_sell: item.unit_sell,
        markup_percent: item.markup_percent,
        vat_rate: item.vat_rate,
        eta_text: item.eta_text,
        supplier_id: item.supplier_id,
        part_brand: item.part_brand,
        part_number: item.part_number,
        selected_for_quote: item.selected_for_quote,
      })
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to duplicate line.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function patchOption(optionId, patch) {
    setSaveBusy(true)
    setError('')
    try {
      await apiPatch(`/api/part-supplier-options/${optionId}`, patch)
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to update supplier option.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function ensureOptionAndPatch(item, supplierId, patch) {
    let option = (item.supplier_options || []).find((o) => Number(o.supplier_id) === Number(supplierId))
    if (!option) {
      const created = await apiPost(`/api/quote-items/${item.id}/supplier-options`, {
        supplier_id: supplierId,
        brand: item.part_brand || null,
        part_number: item.part_number || null,
        cost_price: 0,
        markup_percent: 0,
        sell_price: 0,
        eta_datetime: new Date().toISOString().slice(0, 16),
        eta_text: null,
        is_available: 1,
      })
      option = created.option
    }
    await patchOption(option.id, patch)
  }

  async function selectOption(optionId) {
    setSaveBusy(true)
    setError('')
    try {
      await apiPatch(`/api/part-supplier-options/${optionId}/select`, {})
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to select supplier option.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function autoSelectCheapest(item) {
    const cheapestSupplierId = getCheapestSupplierId(item)
    if (!cheapestSupplierId) return
    const option = (item.supplier_options || []).find((o) => Number(o.supplier_id) === Number(cheapestSupplierId))
    if (option) await selectOption(option.id)
  }

  async function addSupplierColumn() {
    let supplierId = Number(supplierToAdd || 0)
    if (supplierToAdd === 'custom') {
      if (!customSupplierName.trim()) return
      const createdSupplier = await apiPost('/api/suppliers', { name: customSupplierName.trim().toUpperCase(), usage_quotes: 1, usage_parts: 1, usage_mot: 0, usage_diagnostics: 0, usage_general: 1, active: 1 })
      supplierId = Number(createdSupplier?.supplier?.id || 0)
    }
    if (!supplierId) return
    setSaveBusy(true)
    setError('')
    try {
      for (const item of partItems) {
        const exists = (item.supplier_options || []).some((o) => Number(o.supplier_id) === supplierId)
        if (exists) continue
        await apiPost(`/api/quote-items/${item.id}/supplier-options`, {
          supplier_id: supplierId,
          brand: item.part_brand || null,
          part_number: item.part_number || null,
          cost_price: 0,
          markup_percent: 0,
          sell_price: 0,
          eta_datetime: new Date().toISOString().slice(0, 16),
          eta_text: null,
          is_available: 1,
        })
      }
      setSupplierToAdd('')
      setCustomSupplierName('')
      setNotice('Supplier column added.')
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to add supplier.')
    } finally {
      setSaveBusy(false)
    }
  }

  if (status === 'loading') return <div className="emptyState">Loading quote…</div>
  if (status === 'error') return <div className="emptyState">{error}</div>
  if (!quote) return <div className="emptyState">Quote not found.</div>

  return (
    <div className="quoteV3Page">
      <header className="pageHeader">
        <div>
          <VehicleHeader
            reg={quote.vehicle_registration}
            make={quote.vehicle_make}
            model={quote.vehicle_model}
            subtitle={`${quote.customer_first_name} ${quote.customer_surname}`}
            reference={quote.quote_number}
          />
          <p className="pageSubtitle">
            Job #{quote.job_id || '—'} · {quote.title || 'QUOTE'}
          </p>
        </div>
        <div className="pageHeaderActions">
          <button type="button" className="primaryButton" style={{ background: '#f2c94c', color: '#1a1a1a' }} onClick={saveQuoteMeta} disabled={saveBusy}>
            Save quote
          </button>
          <button type="button" className="primaryButton" style={{ background: '#23a455' }} onClick={() => setQuoteStatus('accepted')} disabled={saveBusy}>
            Customer accepts
          </button>
          <StatusChip label={quote.status} tone="chipGrey" />
          <select className="select" value={quote.status} onChange={(e) => setQuoteStatus(e.target.value)}>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button type="button" className="secondaryButton" onClick={onBackToQuotes}>Back</button>
          <button type="button" className="secondaryButton" onClick={() => onViewPartsOrders && onViewPartsOrders(quote.id)}>
            View parts orders
          </button>
          <button type="button" className="secondaryButton noPrint" onClick={async () => { const next = !showCustomerQuote; setShowCustomerQuote(next); if (next) await loadCustomerQuotePreview() }}>
            {showCustomerQuote ? 'Hide customer quote' : 'Preview customer quote'}
          </button>
          <button type="button" className="secondaryButton noPrint" onClick={() => {
            const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000')
            if (!w) return
            w.document.write(`<html><head><title>Quote Preview</title></head><body>${renderedCustomerQuoteHtml || ''}</body></html>`)
            w.document.close()
            w.focus()
            w.print()
          }}>
            Print customer quote
          </button>
        </div>
        <div className="fieldHint" style={{ marginTop: 6 }}>
          {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : saveState === 'failed' ? 'Save failed' : 'Unsaved changes'}
        </div>
      </header>

      {notice ? <div className="notice good">{notice}</div> : null}
      {error ? <div className="notice bad">{error}</div> : null}

      <section className="cardBox quoteMetaPanel">
        <div className="cardTop">
          <h3 className="cardTitle">Quote Context</h3>
          <div className="fieldHint">Linked job/customer and notes</div>
        </div>
        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Title</div>
            <input className="input" value={quoteDraft.title} onChange={(e) => { setQuoteDraft((p) => ({ ...p, title: e.target.value })); setSaveState('unsaved') }} onBlur={(e) => setQuoteDraft((p) => ({ ...p, title: toOperationalUpper(e.target.value) }))} placeholder="QUOTE TITLE" />
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Customer</div>
            <div className="fieldHint" style={{ marginTop: 10 }}>{quote.customer_first_name} {quote.customer_surname} · {quote.customer_phone || '—'}</div>
            <div className="fieldHint" style={{ marginTop: 6 }}>
              {quote.customer_email || 'No email'} · {quote.customer_postcode || 'No postcode'}
            </div>
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Internal notes</div>
            <textarea className="textarea" value={quoteDraft.internal_notes} onChange={(e) => { setQuoteDraft((p) => ({ ...p, internal_notes: e.target.value })); setSaveState('unsaved') }} onBlur={(e) => setQuoteDraft((p) => ({ ...p, internal_notes: toOperationalUpper(e.target.value) }))} placeholder="INTERNAL NOTES" />
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Customer notes</div>
            <textarea className="textarea" value={quoteDraft.customer_notes} onChange={(e) => setQuoteDraft((p) => ({ ...p, customer_notes: e.target.value }))} placeholder="CUSTOMER NOTES" />
          </div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <button type="button" className="secondaryButton" onClick={saveQuoteMeta} disabled={saveBusy}>Save details</button>
          {quote.status === 'accepted' && (!quote.customer_email || !quote.customer_postcode || !quote.customer_address) ? (
            <button type="button" className="secondaryButton" onClick={createCustomerDetailsRequest}>
              Create customer details request
            </button>
          ) : null}
        </div>
        {customerDetailLink ? (
          <div className="notice info" style={{ marginTop: 10 }}>
            Customer details link: <a href={customerDetailLink} target="_blank" rel="noreferrer">{customerDetailLink}</a>
          </div>
        ) : null}
      </section>

      {showCustomerQuote ? (
        <section className="cardBox printDocument" style={{ marginTop: 12 }}>
          <div className="cardTop">
            <h3 className="cardTitle">Customer Quote Preview</h3>
            <div className="fieldHint">Template-rendered customer document (internal costs hidden).</div>
          </div>
          <div className="printDocument" style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: renderedCustomerQuoteHtml || '<p>No preview available.</p>' }} />
        </section>
      ) : null}

      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Parts Comparison</h3>
          <div className="fieldHint">Compare suppliers per part. Cheapest valid supplier is highlighted.</div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <button type="button" className="primaryButton" onClick={() => addLine('part', 'NEW PART')} disabled={saveBusy}>Add part</button>
          <select className="select" value={supplierToAdd} onChange={(e) => setSupplierToAdd(e.target.value)}>
            <option value="">Select supplier…</option>
            {(suppliers || []).filter((s) => Number(s.active) === 1 && Number(s.usage_quotes ?? 1) === 1).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value="custom">CUSTOM</option>
          </select>
          {supplierToAdd === 'custom' ? <input className="input" value={customSupplierName} onChange={(e) => setCustomSupplierName(e.target.value.toUpperCase())} placeholder="CUSTOM SUPPLIER NAME" /> : null}
          <button type="button" className="secondaryButton" onClick={addSupplierColumn} disabled={saveBusy || !supplierToAdd}>Add supplier</button>
          <select className="select" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) addPredefined(v) }}>
            <option value="" disabled>Add predefined…</option>
            {predefined.filter((p) => PART_TYPES.includes(String(p.item_type || ''))).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="comparisonBoardWrap" style={{ marginTop: 12 }}>
          <table className="comparisonBoard">
            <thead>
              <tr>
                <th className="fixedCol">Use</th>
                <th className="partCol">Part</th>
                {quoteSuppliers.map((s) => (
                  <th key={s.id} className="supplierCol">{s.name}</th>
                ))}
                <th className="fixedCol">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!quoteSuppliers.length ? (
                <tr>
                  <td colSpan={3} className="emptyState">
                    No suppliers added yet. Add a supplier to compare prices.
                  </td>
                </tr>
              ) : null}
              {partItems.map((item) => {
                const cheapestId = getCheapestSupplierId(item)
                const effective = getEffectiveOption(item)
                return (
                  <tr key={item.id}>
                    <td>
                      <input type="checkbox" checked={Number(item.selected_for_quote) === 1} onChange={(e) => patchItem(item.id, { selected_for_quote: e.target.checked ? 1 : 0 })} />
                    </td>
                    <td>
                      <div className="partNameCell">
                        <input className="input compactInput" value={item.description || ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { description: toOperationalUpper(e.target.value) })} placeholder="PART NAME" />
                        <div className="partMetaRow">
                          <input className="input compactInput" value={item.part_number || ''} onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, part_number: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { part_number: toOperationalUpper(e.target.value) })} placeholder="PART #" />
                          <input className="input compactInput" value={String(item.quantity || 1)} onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, quantity: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { quantity: e.target.value })} placeholder="Qty" />
                        </div>
                        <div className="fieldHint">Selected: {effective ? `${effective.supplier_name || 'SUP'} · ${formatMoney(effective.sell_price)}` : 'None selected'}</div>
                      </div>
                    </td>
                    {quoteSuppliers.map((supplier) => {
                      const option = (item.supplier_options || []).find((o) => Number(o.supplier_id) === Number(supplier.id))
                      const isSelected = option && Number(option.is_selected) === 1
                      const isCheapest = Number(cheapestId || 0) === Number(supplier.id)
                      const unavailable = option && Number(option.is_available) === 0
                      const ordered = option && Number(option.is_ordered) === 1

                      const cost = option ? toNumber(option.cost_price, 0) : 0
                      const markup = option ? toNumber(option.markup_percent, 0) : 0
                      const sell = option ? toNumber(option.sell_price, 0) : 0
                      const sellInc = round2(sell * (1 + toNumber(option?.vat_rate, quote.vat_rate || 0.2)))

                      return (
                        <td key={`${item.id}-${supplier.id}`}>
                          <div className={`supplierCell ${isSelected ? 'selected' : ''} ${unavailable ? 'na' : ''}`}>
                            <div className="supplierCellTop">
                              <label className="inlineCheck">
                                <input
                                  type="radio"
                                  name={`sel-${item.id}`}
                                  checked={Boolean(isSelected)}
                                  onChange={() => option && selectOption(option.id)}
                                  disabled={!option || unavailable}
                                />
                                <span>{isSelected ? 'Selected' : 'Use'}</span>
                              </label>
                              {isCheapest ? <span className="miniTag">Best £</span> : null}
                              {ordered ? <span className="miniTag warn">Ordered</span> : null}
                            </div>

                            <div className="fieldHint">Brand</div>
                            <input
                              className="input compactInput"
                              defaultValue={option?.brand || ''}
                              onBlur={(e) => ensureOptionAndPatch(item, supplier.id, { brand: toOperationalUpper(e.target.value) || null })}
                              placeholder="e.g. BOSCH"
                            />
                            <div className="fieldHint">ETA date/time</div>
                            <input
                              className="input compactInput"
                              type="datetime-local"
                              defaultValue={option?.eta_datetime ? String(option.eta_datetime).slice(0, 16) : ''}
                              onBlur={(e) =>
                                ensureOptionAndPatch(item, supplier.id, {
                                  eta_datetime: e.target.value || null,
                                  eta_text: e.target.value ? null : option?.eta_text || null,
                                })
                              }
                              title="ETA date/time"
                            />
                            <label className="inlineCheck">
                              <input
                                type="checkbox"
                                checked={String(option?.eta_text || '').toUpperCase() === 'ON SHELF'}
                                onChange={(e) =>
                                  ensureOptionAndPatch(item, supplier.id, {
                                    eta_text: e.target.checked ? 'ON SHELF' : '',
                                    eta_datetime: e.target.checked ? null : option?.eta_datetime || null,
                                  })
                                }
                              />
                              <span>On shelf</span>
                            </label>
                            <div className="supplierNumbers">
                              <div className="fieldHint">Cost ex VAT</div>
                              <input
                                className="input compactInput"
                                defaultValue={cost}
                                onBlur={(e) => {
                                  const nextCost = toNumber(e.target.value, 0)
                                  const nextSell = optionPriceFrom(nextCost, markup)
                                  ensureOptionAndPatch(item, supplier.id, { cost_price: nextCost, markup_percent: markup, sell_price: nextSell })
                                }}
                                placeholder="Cost ex"
                              />
                              <div className="fieldHint">Markup %</div>
                              <input
                                className="input compactInput"
                                defaultValue={markup}
                                onBlur={(e) => {
                                  const nextMarkup = toNumber(e.target.value, 0)
                                  const nextSell = optionPriceFrom(cost, nextMarkup)
                                  ensureOptionAndPatch(item, supplier.id, { cost_price: cost, markup_percent: nextMarkup, sell_price: nextSell })
                                }}
                                placeholder="Markup %"
                              />
                              <div className="fieldHint">Sell ex VAT</div>
                              <input
                                className="input compactInput"
                                defaultValue={sell}
                                onBlur={(e) => {
                                  const nextSell = toNumber(e.target.value, 0)
                                  const nextMarkup = optionMarkupFrom(cost, nextSell)
                                  ensureOptionAndPatch(item, supplier.id, { cost_price: cost, sell_price: nextSell, markup_percent: nextMarkup })
                                }}
                                placeholder="Sell ex"
                              />
                            </div>
                            <div className="supplierCellFooter">
                              <span className="fieldHint">Inc VAT {formatMoney(sellInc)}</span>
                              <label className="inlineCheck">
                                <input
                                  type="checkbox"
                                  checked={Boolean(unavailable)}
                                  onChange={(e) => option && patchOption(option.id, { is_available: e.target.checked ? 0 : 1 })}
                                />
                                <span>Not available</span>
                              </label>
                              <label className="inlineCheck">
                                <input
                                  type="checkbox"
                                  checked={Boolean(ordered)}
                                  onChange={(e) => option && patchOption(option.id, { is_ordered: e.target.checked ? 1 : 0 })}
                                />
                                <span>Ordered</span>
                              </label>
                            </div>
                          </div>
                        </td>
                      )
                    })}
                    <td>
                      <div className="rowActions">
                        <button type="button" className="miniButton" onClick={() => autoSelectCheapest(item)}>Auto best</button>
                        <button type="button" className="miniButton" onClick={() => duplicateItem(item)}>Duplicate</button>
                        <button type="button" className="miniButton danger" onClick={() => removeItem(item.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Labour</h3>
          <div className="fieldHint">Separate from parts comparison.</div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <button type="button" className="primaryButton" onClick={() => addLine('labour', 'LABOUR')} disabled={saveBusy}>Add labour</button>
          <select className="select" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value=''; if(v) addPredefined(v) }}>
            <option value="" disabled>Add labour preset…</option>
            {predefined.filter((p) => LABOUR_TYPES.includes(String(p.item_type || ''))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="quoteTableWrap" style={{ marginTop: 10 }}>
          <table className="quoteTable labourTable">
            <thead>
              <tr><th>Use</th><th>Item</th><th>Hours</th><th>Rate ex VAT</th><th>Sell ex VAT</th><th>Sell inc VAT</th><th>Total</th><th></th></tr>
            </thead>
            <tbody>
              {labourItems.map((item) => {
                const vatRate = toNumber(item.vat_rate, quote.vat_rate || 0.2)
                const sellInc = round2(toNumber(item.unit_sell, 0) * (1 + vatRate))
                const lineTotal = round2(toNumber(item.quantity, 1) * toNumber(item.unit_sell, 0))
                return (
                  <tr key={item.id}>
                    <td><input type="checkbox" checked={Number(item.selected_for_quote) === 1} onChange={(e) => patchItem(item.id, { selected_for_quote: e.target.checked ? 1 : 0 })} /></td>
                    <td><input className="input compactInput" value={item.description || ''} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { description: toOperationalUpper(e.target.value) })} /></td>
                    <td><input className="input compactInput" value={String(item.quantity || 1)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, quantity: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { quantity: e.target.value })} /></td>
                    <td><input className="input compactInput" value={String(item.unit_cost || 0)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, unit_cost: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { unit_cost: e.target.value })} /></td>
                    <td><input className="input compactInput" value={String(item.unit_sell || 0)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, unit_sell: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { unit_sell: e.target.value })} /></td>
                    <td>{formatMoney(sellInc)}</td>
                    <td>{formatMoney(lineTotal)}</td>
                    <td>
                      <div className="rowActions">
                        <button type="button" className="miniButton" onClick={() => duplicateItem(item)}>Duplicate</button>
                        <button type="button" className="miniButton danger" onClick={() => removeItem(item.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Consumables / Default Costs</h3>
          <div className="fieldHint">Quick add from predefined items (admin-controlled).</div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <select className="select" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value=''; if(v) addPredefined(v) }}>
            <option value="" disabled>Select consumable…</option>
            {predefined.filter((p) => ['oil', 'other', 'service_item'].includes(String(p.item_type || ''))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="fieldHint" style={{ marginTop: 10 }}>
          Use the Parts and Labour sections to edit the added lines inline.
        </div>
      </section>

      <section className="quoteTotalsBar" style={{ marginTop: 12 }}>
        <div className="totalsGrid">
          <div className="totalsItem"><div className="totalsLabel">Labour total ex VAT</div><div className="totalsValue"><MoneyDisplay value={totalsView.labourEx} /></div></div>
          <div className="totalsItem"><div className="totalsLabel">Consumables total ex VAT</div><div className="totalsValue"><MoneyDisplay value={totalsView.consumablesEx} /></div></div>
          <div className="totalsItem"><div className="totalsLabel">Parts total ex VAT</div><div className="totalsValue"><MoneyDisplay value={totalsView.partsEx} /></div></div>
          <div className="totalsItem"><div className="totalsLabel">Included lines</div><div className="totalsValue">{totalsView.lines}</div></div>
          <div className="totalsItem"><div className="totalsLabel">Cost total ex VAT</div><div className="totalsValue"><MoneyDisplay value={totalsView.costEx} /></div></div>
          <div className="totalsItem"><div className="totalsLabel">Sell ex VAT</div><div className="totalsValue"><MoneyDisplay value={totalsView.sellEx} /></div></div>
          <div className="totalsItem"><div className="totalsLabel">VAT</div><div className="totalsValue"><MoneyDisplay value={totalsView.vat} /></div></div>
          <div className="totalsItem emphasis"><div className="totalsLabel">Sell inc VAT</div><div className="totalsValue"><MoneyDisplay value={totalsView.sellInc} /></div></div>
          <div className="totalsItem"><div className="totalsLabel">Margin</div><div className="totalsValue"><MoneyDisplay value={totalsView.margin} /></div></div>
        </div>
      </section>

      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Parts Orders</h3>
          <div className="fieldHint">Created after quote acceptance for supplier-linked lines.</div>
        </div>
        {partsOrders.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 10 }}>
            <table className="quoteTable">
              <thead><tr><th>Status</th><th>Part</th><th>Supplier</th><th>ETA</th><th>Qty</th></tr></thead>
              <tbody>
                {partsOrders.map((po) => (
                  <tr key={po.id}>
                    <td><StatusChip label={po.status} tone="chipGrey" /></td>
                    <td>{po.part_name || po.description || '—'}</td>
                    <td>{po.supplier_name || '—'}</td>
                    <td>{po.eta_text || '—'}</td>
                    <td>{po.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="emptyState" style={{ marginTop: 12 }}>No parts orders for this quote yet.</div>}
      </section>

      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Activity</h3>
          <div className="fieldHint">{activity.length} entries</div>
        </div>
        {activity.length ? (
          <div className="activityList">
            {activity.map((entry) => (
              <div className="activityItem" key={entry.id}>
                <div className="tinyMeta">{new Date(entry.created_at).toLocaleString('en-GB')}</div>
                <div className="activityMain">{entry.summary}</div>
                <div className="fieldHint">{entry.user_name || 'SYSTEM'} · {entry.action}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>No activity yet.</div>
        )}
      </section>
    </div>
  )
}
