// Quote page refactored by Claude Code for per-part supplier comparison UX. See docs/CLAUDE_QUOTE_PAGE_NOTES.md before major rewrites.
import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { toOperationalUpper } from '../utils/text'
import VehicleHeader from '../components/VehicleHeader'
import StatusChip from '../components/StatusChip'
import MoneyDisplay from '../components/MoneyDisplay'

const QUOTE_STATUSES = ['draft', 'ready', 'sent', 'accepted', 'rejected', 'completed']
const PART_TYPES = ['part']
const LABOUR_TYPES = ['labour']
const FIXED_TYPES = ['diagnostic', 'mot_repair', 'other']
const CONSUMABLE_TYPES = ['oil', 'service_item']

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

export default function QuoteDetail({ quoteId, onBackToQuotes, onViewPartsOrders, onOpenQuote }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveState, setSaveState] = useState('saved')
  const [reloadCount, setReloadCount] = useState(0)

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
  const [partSupplierDrafts, setPartSupplierDrafts] = useState({})
  const [quoteContextOpen, setQuoteContextOpen] = useState(true)
  const [partsDrawerOpen, setPartsDrawerOpen] = useState(false)
  const [partsOrderBusyId, setPartsOrderBusyId] = useState(0)
  const [partsOrderError, setPartsOrderError] = useState('')

  const partItems = useMemo(() => (items || []).filter((i) => PART_TYPES.includes(String(i.item_type || ''))), [items])
  const labourItems = useMemo(() => (items || []).filter((i) => LABOUR_TYPES.includes(String(i.item_type || ''))), [items])
  const fixedItems = useMemo(() => (items || []).filter((i) => FIXED_TYPES.includes(String(i.item_type || ''))), [items])
  const consumableItems = useMemo(() => (items || []).filter((i) => CONSUMABLE_TYPES.includes(String(i.item_type || ''))), [items])

  const totalsView = useMemo(() => {
    const vatDefault = toNumber(quote?.vat_rate, 0.2)
    let costEx = 0
    let sellEx = 0
    let vat = 0
    let lines = 0
    let labourEx = 0
    let fixedEx = 0
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
        else if (FIXED_TYPES.includes(String(item.item_type || ''))) fixedEx += qty * sell
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
      fixedEx: round2(fixedEx),
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
      setReloadCount((c) => c + 1)
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

  async function createRevisedQuote() {
    if (!quote || !quote.id) return
    const reason = window.prompt('Reason for revised/additional quote', 'Additional work discovered')
    if (reason == null) return
    setSaveBusy(true)
    setError('')
    setNotice('')
    try {
      const out = await apiPost(`/api/quotes/${quote.id}/revise`, { revision_reason: reason })
      if (out && out.quote && out.quote.id) {
        setNotice(`Revised quote created: ${out.quote.quote_number}`)
        if (typeof onOpenQuote === 'function') onOpenQuote(out.quote.id)
      }
    } catch (err) {
      setError(err.message || 'Failed to create revised quote.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function loadCustomerQuotePreview() {
    try {
      const out = await apiPost('/api/templates/customer_quote/render', { quote_id: quoteId })
      const html = out.rendered_html || ''
      setRenderedCustomerQuoteHtml(html)
      return html
    } catch (err) {
      setError(err.message || 'Failed to render customer quote preview.')
      return ''
    }
  }

  async function printCustomerQuoteDocument() {
    // Use returned html directly — React state updates are async so renderedCustomerQuoteHtml may be stale.
    let html = renderedCustomerQuoteHtml
    if (!html) {
      html = await loadCustomerQuotePreview()
    }
    if (!html) return
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Customer Quote</title><style>body{font-family:Arial,sans-serif;padding:16px;color:#111}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left}</style></head><body>${html}</body></html>`)
    doc.close()
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1200)
    }, 200)
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

  async function addSupplierToPart(itemId) {
    const draft = partSupplierDrafts[itemId] || {}
    let supplierId = Number(draft.supplier_id || 0)
    if (String(draft.supplier_id || '') === 'custom') {
      if (!String(draft.custom_name || '').trim()) return
      const createdSupplier = await apiPost('/api/suppliers', {
        name: toOperationalUpper(draft.custom_name),
        usage_quotes: 1,
        usage_parts: 1,
        usage_mot: 0,
        usage_diagnostics: 0,
        usage_general: 1,
        active: 1,
      })
      supplierId = Number(createdSupplier?.supplier?.id || 0)
    }
    if (!supplierId) return
    const item = partItems.find((x) => Number(x.id) === Number(itemId))
    if (!item) return
    setSaveBusy(true)
    setError('')
    try {
      const exists = (item.supplier_options || []).some((o) => Number(o.supplier_id) === supplierId)
      if (!exists) {
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
      setPartSupplierDrafts((prev) => ({ ...prev, [itemId]: { supplier_id: '', custom_name: '' } }))
      setNotice('Supplier added to part.')
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setError(err.message || 'Failed to add supplier.')
    } finally {
      setSaveBusy(false)
    }
  }

  async function updatePartsOrderStatus(orderId, nextStatus) {
    setPartsOrderBusyId(Number(orderId))
    setPartsOrderError('')
    try {
      await apiPatch(`/api/parts-orders/${orderId}/status`, { status: nextStatus })
      await load({ preserveScroll: true, keepStatus: true })
    } catch (err) {
      setPartsOrderError(err.message || 'Failed to update parts order status.')
    } finally {
      setPartsOrderBusyId(0)
    }
  }

  if (status === 'loading') return <div className="emptyState">Loading quote…</div>
  if (status === 'error') return <div className="emptyState">{error}</div>
  if (!quote) return <div className="emptyState">Quote not found.</div>

  return (
    <div className="quoteV3Page">

      {/* === QUOTE HEADER === */}
      <header className="pageHeader quotePageHeader">
        <div className="quoteHeaderLeft">
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
          {!quote.vehicle_registration ? (
            <div className="notice warn" style={{ marginTop: 8 }}>
              Registration missing - check linked vehicle/job.
            </div>
          ) : null}
          {Number(quote.revision_number || 1) > 1 ? (
            <div className="fieldHint" style={{ marginTop: 4 }}>
              Revision R{quote.revision_number} · Parent {quote.parent_quote_number || quote.parent_quote_id || '—'}
            </div>
          ) : null}
        </div>
        <div className="quoteHeaderRight">
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
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 8 }}>
            <button type="button" className="secondaryButton" onClick={onBackToQuotes}>Back</button>
            <button type="button" className="secondaryButton" onClick={() => { setPartsOrderError(''); setPartsDrawerOpen(true) }}>
              Parts orders ({partsOrders.length})
            </button>
            {quote.status === 'accepted' ? (
              <button type="button" className="secondaryButton" onClick={createRevisedQuote} disabled={saveBusy}>
                Create Additional Quote
              </button>
            ) : null}
            <button type="button" className="secondaryButton noPrint" onClick={async () => { const next = !showCustomerQuote; setShowCustomerQuote(next); if (next) await loadCustomerQuotePreview() }}>
              {showCustomerQuote ? 'Hide preview' : 'Preview quote'}
            </button>
            <button type="button" className="secondaryButton noPrint" onClick={printCustomerQuoteDocument}>
              Print quote
            </button>
          </div>
          <div className="fieldHint" style={{ marginTop: 6 }}>
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : saveState === 'failed' ? 'Save failed' : 'Unsaved changes'}
          </div>
        </div>
      </header>

      {notice ? <div className="notice good">{notice}</div> : null}
      {error ? <div className="notice bad">{error}</div> : null}

      {/* === QUOTE CONTEXT (collapsible, default open) === */}
      <section className="cardBox quoteMetaPanel" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <div>
            <h3 className="cardTitle">Quote Content</h3>
            <div className="fieldHint">Title, customer details, notes.</div>
          </div>
          <button
            type="button"
            className="miniButton"
            aria-expanded={quoteContextOpen}
            onClick={() => setQuoteContextOpen((v) => !v)}
          >
            {quoteContextOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>
        {quoteContextOpen ? (
          <>
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
          </>
        ) : (
          <div className="fieldHint" style={{ marginTop: 6 }}>
            {(quoteDraft.title || 'No title').toUpperCase()} · {quote.customer_first_name} {quote.customer_surname}
          </div>
        )}
      </section>

      {/* === CUSTOMER QUOTE PREVIEW === */}
      {showCustomerQuote ? (
        <section className="cardBox" style={{ marginTop: 12 }}>
          <div className="cardTop">
            <h3 className="cardTitle">Customer Quote Preview</h3>
            <div className="fieldHint">Template-rendered customer document — internal costs hidden.</div>
          </div>
          <div style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: renderedCustomerQuoteHtml || '<p>No preview available.</p>' }} />
        </section>
      ) : null}

      {/* === LABOUR === */}
      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Labour</h3>
          <div className="fieldHint">Hours × rate.</div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <button type="button" className="primaryButton" onClick={() => addLine('labour', 'LABOUR')} disabled={saveBusy}>Add labour</button>
          <select className="select" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) addPredefined(v) }}>
            <option value="" disabled>Add labour preset…</option>
            {predefined.filter((p) => LABOUR_TYPES.includes(String(p.item_type || ''))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {labourItems.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 10 }}>
            <table className="quoteTable quoteSimpleTable labourTable">
              <thead>
                <tr><th>Use</th><th>Description</th><th>Hrs</th><th>Rate ex VAT</th><th>Sell ex VAT</th><th>Inc VAT</th><th>Line total</th><th></th></tr>
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
                      <td><input className="input compactInput qtyInput" value={String(item.quantity || 1)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, quantity: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { quantity: e.target.value })} /></td>
                      <td><input className="input compactInput" value={String(item.unit_cost || 0)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, unit_cost: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { unit_cost: e.target.value })} /></td>
                      <td><input className="input compactInput" value={String(item.unit_sell || 0)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, unit_sell: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { unit_sell: e.target.value })} /></td>
                      <td><span className="incVatSmall">{formatMoney(sellInc)}</span></td>
                      <td><span className="incVatSmall">{formatMoney(lineTotal)}</span></td>
                      <td>
                        <div className="rowActions">
                          <button type="button" className="miniButton" onClick={() => duplicateItem(item)} disabled={saveBusy}>Dup</button>
                          <button type="button" className="miniButton danger" onClick={() => removeItem(item.id)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="emptyState" style={{ marginTop: 10 }}>No labour lines added.</div>}
      </section>

      {/* === FIXED COSTS (includes consumables) === */}
      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Fixed Costs</h3>
          <div className="fieldHint">Diagnostics, fixed workshop charges, oils and consumables.</div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <select className="select" defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) addPredefined(v) }}>
            <option value="" disabled>Add predefined charge…</option>
            {predefined.filter((p) => FIXED_TYPES.includes(String(p.item_type || ''))).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {predefined.filter((p) => CONSUMABLE_TYPES.includes(String(p.item_type || ''))).map((p) => <option key={p.id} value={p.id}>{p.name} (consumable)</option>)}
          </select>
          <button type="button" className="primaryButton" onClick={() => addLine('diagnostic', 'DIAGNOSTIC')} disabled={saveBusy}>Add charge</button>
          <button type="button" className="secondaryButton" onClick={() => addLine('oil', 'CONSUMABLE')} disabled={saveBusy}>Add consumable</button>
        </div>
        {(fixedItems.length + consumableItems.length) ? (
          <div className="quoteTableWrap" style={{ marginTop: 10 }}>
            <table className="quoteTable quoteSimpleTable">
              <thead>
                <tr><th>Use</th><th>Item</th><th>Type</th><th>Qty</th><th>Sell ex VAT</th><th>Inc VAT</th><th></th></tr>
              </thead>
              <tbody>
                {[...fixedItems, ...consumableItems].map((item) => {
                  const vatRate = toNumber(item.vat_rate, quote.vat_rate || 0.2)
                  const sellInc = round2(toNumber(item.unit_sell, 0) * (1 + vatRate))
                  const isConsumable = CONSUMABLE_TYPES.includes(String(item.item_type || ''))
                  return (
                    <tr key={item.id}>
                      <td><input type="checkbox" checked={Number(item.selected_for_quote) === 1} onChange={(e) => patchItem(item.id, { selected_for_quote: e.target.checked ? 1 : 0 })} /></td>
                      <td><input className="input compactInput" value={item.description || ''} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { description: toOperationalUpper(e.target.value) })} /></td>
                      <td><span className={`miniTag${isConsumable ? ' warn' : ''}`}>{isConsumable ? 'CONSUMABLE' : String(item.item_type || 'FIXED').toUpperCase()}</span></td>
                      <td><input className="input compactInput qtyInput" value={String(item.quantity || 1)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, quantity: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { quantity: e.target.value })} /></td>
                      <td><input className="input compactInput" value={String(item.unit_sell || 0)} onChange={(e) => setItems((p) => p.map((x) => x.id === item.id ? { ...x, unit_sell: e.target.value } : x))} onBlur={(e) => patchItem(item.id, { unit_sell: e.target.value })} /></td>
                      <td><span className="incVatSmall">{formatMoney(sellInc)}</span></td>
                      <td><button type="button" className="miniButton danger" onClick={() => removeItem(item.id)}>Remove</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="emptyState" style={{ marginTop: 10 }}>No fixed costs or consumables added.</div>}
      </section>

      {/* === PARTS COMPARISON — per-part supplier cards, horizontal scroll per part === */}
      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Parts Comparison</h3>
          <div className="fieldHint">Per-part supplier comparison — each part manages its own suppliers.</div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 10 }}>
          <button type="button" className="primaryButton" onClick={() => addLine('part', 'NEW PART')} disabled={saveBusy}>+ Add part</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {partItems.length ? partItems.map((item) => {
            const cheapestId = getCheapestSupplierId(item)
            const effective = getEffectiveOption(item)
            const draft = partSupplierDrafts[item.id] || { supplier_id: '', custom_name: '' }
            const itemVatRate = toNumber(item.vat_rate, toNumber(quote?.vat_rate, 0.2))
            return (
              <article key={item.id} className={`partCard ${Number(item.selected_for_quote) === 1 ? 'partCardActive' : 'partCardDim'}`}>

                {/* Part top row: include / name / part no / qty / actions */}
                <div className="partCardTopRow">
                  <label className="inlineCheck">
                    <input type="checkbox" checked={Number(item.selected_for_quote) === 1} onChange={(e) => patchItem(item.id, { selected_for_quote: e.target.checked ? 1 : 0 })} />
                    <span>Inc</span>
                  </label>
                  <input
                    className="input compactInput partNameInput"
                    value={item.description || ''}
                    onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, description: e.target.value } : x))}
                    onBlur={(e) => patchItem(item.id, { description: toOperationalUpper(e.target.value) })}
                    placeholder="PART NAME"
                  />
                  <input
                    className="input compactInput partNumInput"
                    value={item.part_number || ''}
                    onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, part_number: e.target.value } : x))}
                    onBlur={(e) => patchItem(item.id, { part_number: toOperationalUpper(e.target.value) })}
                    placeholder="PART NO."
                  />
                  <input
                    className="input compactInput qtyInput"
                    value={String(item.quantity || 1)}
                    onChange={(e) => setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, quantity: e.target.value } : x))}
                    onBlur={(e) => patchItem(item.id, { quantity: e.target.value })}
                    placeholder="QTY"
                  />
                  <div className="partCardActions">
                    <button type="button" className="miniButton" onClick={() => duplicateItem(item)} disabled={saveBusy}>Dup</button>
                    <button type="button" className="miniButton danger" onClick={() => removeItem(item.id)}>Remove</button>
                  </div>
                </div>

                {/* Supplier summary + add-supplier controls */}
                <div className="partActionsRow">
                  <span className="fieldHint partSupplierSummary">
                    {effective
                      ? <><strong>{effective.supplier_name || 'SUPPLIER'}</strong> · {formatMoney(effective.sell_price)} ex VAT</>
                      : 'No supplier selected — cheapest valid used if available'}
                  </span>
                  <select
                    className="select"
                    value={draft.supplier_id}
                    onChange={(e) => setPartSupplierDrafts((p) => ({ ...p, [item.id]: { ...draft, supplier_id: e.target.value } }))}
                  >
                    <option value="">Add supplier to this part…</option>
                    {(suppliers || []).filter((s) => Number(s.active) === 1 && Number(s.usage_quotes ?? 1) === 1).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="custom">CUSTOM SUPPLIER</option>
                  </select>
                  {draft.supplier_id === 'custom' ? (
                    <input
                      className="input compactInput"
                      value={draft.custom_name || ''}
                      onChange={(e) => setPartSupplierDrafts((p) => ({ ...p, [item.id]: { ...draft, custom_name: e.target.value.toUpperCase() } }))}
                      placeholder="CUSTOM SUPPLIER NAME"
                      style={{ maxWidth: 200 }}
                    />
                  ) : null}
                  <button type="button" className="miniButton primary" onClick={() => addSupplierToPart(item.id)} disabled={!draft.supplier_id || saveBusy}>
                    Add supplier
                  </button>
                  <button type="button" className="miniButton" onClick={() => autoSelectCheapest(item)} disabled={saveBusy}>
                    Auto best
                  </button>
                </div>

                {/* Supplier option cards — horizontal scroll scoped to this part only */}
                <div className="partSupplierScroller">
                  {(item.supplier_options || []).length ? (item.supplier_options || []).map((option) => {
                    const isSelected = Number(option.is_selected) === 1
                    const isCheapest = Number(cheapestId || 0) === Number(option.supplier_id || 0)
                    const unavailable = Number(option.is_available) === 0
                    const ordered = Number(option.is_ordered) === 1
                    const cost = toNumber(option.cost_price, 0)
                    const markup = toNumber(option.markup_percent, 0)
                    const sell = toNumber(option.sell_price, 0)
                    const sellInc = round2(sell * (1 + itemVatRate))
                    return (
                      <div
                        key={`${option.id}_${reloadCount}`}
                        className={[
                          'supplierCell',
                          isSelected ? 'selected' : '',
                          unavailable ? 'na' : '',
                          isCheapest && !unavailable ? 'cheapest' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {/* Row 1: Supplier name + all status chips */}
                        <div className="supplierCellTop">
                          <strong className="supplierCellName">{option.supplier_name || 'SUPPLIER'}</strong>
                          <div className="supplierCellBadges">
                            {isSelected ? <span className="miniTag selected">✓ Selected</span> : null}
                            {isCheapest && !unavailable ? <span className="miniTag">Best £</span> : null}
                            {ordered ? <span className="miniTag warn">Ordered</span> : null}
                            {unavailable ? <span className="miniTag na">N/A</span> : null}
                          </div>
                        </div>

                        {/* Row 2: Brand + Part No */}
                        <div className="supplierNumbers">
                          <input className="input compactInput" defaultValue={option.brand || ''} placeholder="Brand" onBlur={(e) => patchOption(option.id, { brand: toOperationalUpper(e.target.value) || null })} />
                          <input className="input compactInput" defaultValue={option.part_number || ''} placeholder="Part No." onBlur={(e) => patchOption(option.id, { part_number: toOperationalUpper(e.target.value) || null })} />
                        </div>

                        {/* Row 3: ETA datetime + On shelf — ETA uses dedicated row to avoid datetime-local overflow */}
                        <div className="supplierEtaRow">
                          <input
                            type="datetime-local"
                            defaultValue={option?.eta_datetime ? String(option.eta_datetime).slice(0, 16) : new Date().toISOString().slice(0, 16)}
                            onBlur={(e) => patchOption(option.id, { eta_datetime: e.target.value || null, eta_text: e.target.value ? null : option?.eta_text || null })}
                          />
                          <label className="inlineCheck">
                            <input
                              type="checkbox"
                              checked={String(option?.eta_text || '').toUpperCase() === 'ON SHELF'}
                              onChange={(e) => patchOption(option.id, { eta_text: e.target.checked ? 'ON SHELF' : '', eta_datetime: e.target.checked ? null : option?.eta_datetime || null })}
                            />
                            <span>On shelf</span>
                          </label>
                        </div>

                        {/* Row 4: Cost / Markup / Sell — three equal columns */}
                        <div className="supplierPriceGrid">
                          <input
                            className="input compactInput"
                            defaultValue={cost}
                            placeholder="Cost ex VAT"
                            onBlur={(e) => {
                              const nc = toNumber(e.target.value, 0)
                              const ns = optionPriceFrom(nc, markup)
                              patchOption(option.id, { cost_price: nc, markup_percent: markup, sell_price: ns })
                            }}
                          />
                          <input
                            className="input compactInput"
                            defaultValue={markup}
                            placeholder="Markup %"
                            onBlur={(e) => {
                              const nm = toNumber(e.target.value, 0)
                              const ns = optionPriceFrom(cost, nm)
                              patchOption(option.id, { cost_price: cost, markup_percent: nm, sell_price: ns })
                            }}
                          />
                          <input
                            className="input compactInput"
                            defaultValue={sell}
                            placeholder="Sell ex VAT"
                            onBlur={(e) => {
                              const ns = toNumber(e.target.value, 0)
                              const nm = optionMarkupFrom(cost, ns)
                              patchOption(option.id, { cost_price: cost, sell_price: ns, markup_percent: nm })
                            }}
                          />
                        </div>

                        {/* Row 5: Inc VAT — gold badge, full width */}
                        <div className="incVatBadge">Inc VAT {formatMoney(sellInc)}</div>

                        {/* Row 6: Select / N/A / Ordered controls */}
                        <div className="supplierCellFooter">
                          <label className="inlineCheck">
                            <input type="radio" name={`sel-${item.id}`} checked={Boolean(isSelected)} onChange={() => selectOption(option.id)} disabled={unavailable} />
                            <span>Select</span>
                          </label>
                          <label className="inlineCheck">
                            <input type="checkbox" checked={Boolean(unavailable)} onChange={(e) => patchOption(option.id, { is_available: e.target.checked ? 0 : 1 })} />
                            <span>N/A</span>
                          </label>
                          <label className="inlineCheck">
                            <input type="checkbox" checked={Boolean(ordered)} onChange={(e) => patchOption(option.id, { is_ordered: e.target.checked ? 1 : 0 })} />
                            <span>Ordered</span>
                          </label>
                        </div>
                      </div>
                    )
                  }) : <div className="emptyState" style={{ padding: '12px 0' }}>No suppliers added yet. Use "Add supplier" above.</div>}
                </div>

              </article>
            )
          }) : <div className="emptyState" style={{ marginTop: 12 }}>No parts added. Click "+ Add part" to start.</div>}
        </div>
      </section>

      {/* === PARTS ORDERS === */}
      <section className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Parts Orders</h3>
          <div className="fieldHint">Created after quote acceptance for supplier-linked lines.</div>
        </div>
        {partsOrders.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 10 }}>
            <table className="quoteTable quoteSimpleTable">
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

      {/* === ACTIVITY === */}
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

      {/* Spacer so content is not hidden by the sticky bottom totals bar */}
      <div className="quoteStickyTotalsSpacer" aria-hidden="true" />

      {/* === STICKY BOTTOM TOTALS BAR === */}
      <div className="quoteStickyTotals" role="status" aria-label="Quote totals">
        <div className="quoteStickyTotalsInner">
          <div className="stickyTotal">
            <div className="stickyTotalLabel">Cost Price</div>
            <div className="stickyTotalValue"><MoneyDisplay value={totalsView.costEx} /></div>
          </div>
          <div className="stickyTotal">
            <div className="stickyTotalLabel">Total EX VAT</div>
            <div className="stickyTotalValue"><MoneyDisplay value={totalsView.sellEx} /></div>
          </div>
          <div className="stickyTotal stickyTotalEmphasis">
            <div className="stickyTotalLabel">Total INC VAT</div>
            <div className="stickyTotalValue"><MoneyDisplay value={totalsView.sellInc} /></div>
          </div>
          <div className={`stickyTotal ${totalsView.margin >= 0 ? 'stickyTotalPos' : 'stickyTotalNeg'}`}>
            <div className="stickyTotalLabel">Margin</div>
            <div className="stickyTotalValue"><MoneyDisplay value={totalsView.margin} /></div>
          </div>
        </div>
      </div>

      {/* === PARTS ORDERS DRAWER === */}
      {partsDrawerOpen ? (
        <div className="modalOverlay" role="dialog" aria-modal="true" onClick={() => setPartsDrawerOpen(false)}>
          <div className="modal modalWide partsOrdersDrawer" onClick={(e) => e.stopPropagation()}>
            <div className="modalTop">
              <div>
                <div style={{ fontWeight: 950 }}>Parts orders for quote {quote.quote_number}</div>
                <div className="fieldHint">{partsOrders.length} order(s) — {quote.status === 'accepted' ? 'created on acceptance' : 'created automatically when the quote is accepted'}.</div>
              </div>
              <button type="button" className="miniButton" onClick={() => setPartsDrawerOpen(false)}>✕</button>
            </div>

            {partsOrderError ? <div className="notice bad">{partsOrderError}</div> : null}

            {partsOrders.length ? (
              <div className="quoteTableWrap" style={{ marginTop: 12 }}>
                <table className="quoteTable quoteSimpleTable">
                  <thead>
                    <tr><th>Part</th><th>Supplier</th><th>ETA</th><th>Qty</th><th>Status</th><th>Update</th></tr>
                  </thead>
                  <tbody>
                    {partsOrders.map((po) => {
                      const busy = Number(partsOrderBusyId) === Number(po.id)
                      return (
                        <tr key={po.id}>
                          <td>{po.part_name || po.description || '—'}</td>
                          <td>{po.supplier_name || '—'}</td>
                          <td>{po.eta_text || '—'}</td>
                          <td>{po.quantity}</td>
                          <td><StatusChip label={po.status} tone="chipGrey" /></td>
                          <td>
                            <select
                              className="select"
                              value={po.status}
                              disabled={busy}
                              onChange={(e) => updatePartsOrderStatus(po.id, e.target.value)}
                            >
                              <option value="pending">needed</option>
                              <option value="ordered">ordered</option>
                              <option value="received">received</option>
                              <option value="return_required">return required</option>
                              <option value="returned">returned</option>
                              <option value="cancelled">cancelled</option>
                            </select>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyState" style={{ marginTop: 12 }}>
                No parts orders for this quote yet. Accept the quote to auto-create supplier orders, or use the full Parts page to add ad-hoc orders.
              </div>
            )}

            <div className="pageHeaderActions" style={{ marginTop: 12 }}>
              <button type="button" className="secondaryButton" onClick={() => onViewPartsOrders && onViewPartsOrders(quote.id)}>
                Open full Parts page
              </button>
              <button type="button" className="primaryButton" onClick={() => setPartsDrawerOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}
