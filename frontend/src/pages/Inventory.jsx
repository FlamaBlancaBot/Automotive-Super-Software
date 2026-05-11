import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

function money(value) {
  const n = Number(value || 0)
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function qty(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n.toLocaleString('en-GB', { maximumFractionDigits: 3 }) : '0'
}

function dateOnly(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-GB')
}

function statusMeta(item) {
  if (!Number(item.active)) return { label: 'Inactive', tone: 'chipGrey' }
  const isLow = Number(item.quantity_on_hand || 0) <= Number(item.reorder_point || 0)
  const exp = item.expiry_date ? new Date(item.expiry_date) : null
  const now = new Date()
  const soon = exp && !Number.isNaN(exp.getTime()) && exp.getTime() <= now.getTime() + 30 * 24 * 60 * 60 * 1000
  if (soon) return { label: 'Expiring', tone: 'chipYellow' }
  if (isLow) return { label: 'Low Stock', tone: 'chipOrange' }
  return { label: 'OK', tone: 'chipGreen' }
}

const MOVEMENT_TYPES = [
  'opening_balance',
  'stock_in',
  'stock_out',
  'job_usage',
  'return_to_stock',
  'supplier_return',
  'adjustment',
  'wastage',
]

const emptyItem = {
  sku: '', name: '', category: '', description: '', supplier_name: '', supplier_part_number: '',
  unit_cost: '', sell_price: '', quantity_on_hand: '0', reorder_point: '0', reorder_quantity: '',
  unit_of_measure: 'unit', storage_location: '', expiry_date: '', active: true,
}

export default function Inventory() {
  const [loading, setLoading] = useState('loading')
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({ q: '', category: '', lowStock: false, active: 'true' })

  const [itemModal, setItemModal] = useState(null)
  const [itemDraft, setItemDraft] = useState(emptyItem)

  const [movementModal, setMovementModal] = useState(null)
  const [movements, setMovements] = useState([])
  const [movementDraft, setMovementDraft] = useState({ movement_type: 'stock_in', quantity: '', job_id: '', quote_id: '', parts_order_id: '', unit_cost: '', reference: '', notes: '' })

  const [suppliersModal, setSuppliersModal] = useState(null)
  const [itemSuppliers, setItemSuppliers] = useState([])
  const [supplierDraft, setSupplierDraft] = useState({ supplier_name: '', supplier_part_number: '', unit_cost: '', lead_time_days: '', preferred: false, active: true })

  useEffect(() => setDocumentTitle('Inventory'), [])

  async function load() {
    setLoading('loading')
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.q.trim()) params.set('q', filters.q.trim())
      if (filters.category.trim()) params.set('category', filters.category.trim())
      params.set('active', filters.active)
      if (filters.lowStock) params.set('low_stock', 'true')
      const [itemsRes, summaryRes] = await Promise.all([
        apiGet(`/api/inventory/items?${params.toString()}`),
        apiGet('/api/inventory/summary'),
      ])
      setItems(itemsRes.items || [])
      setSummary(summaryRes.summary || null)
      setLoading('ready')
    } catch (err) {
      setError(err.message || 'Failed to load inventory.')
      setLoading('error')
    }
  }

  useEffect(() => { load() }, [filters.active, filters.lowStock])

  const categories = useMemo(() => {
    const set = new Set((items || []).map((x) => String(x.category || '').trim()).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [items])

  const shownItems = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return (items || []).filter((i) => {
      if (filters.category && i.category !== filters.category) return false
      if (!q) return true
      return [i.sku, i.name, i.supplier_name, i.storage_location].some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [items, filters.q, filters.category])

  function openCreate() {
    setItemModal({ mode: 'create', item: null })
    setItemDraft(emptyItem)
  }

  function openEdit(item) {
    setItemModal({ mode: 'edit', item })
    setItemDraft({
      sku: item.sku || '', name: item.name || '', category: item.category || '', description: item.description || '',
      supplier_name: item.supplier_name || '', supplier_part_number: item.supplier_part_number || '',
      unit_cost: item.unit_cost ?? '', sell_price: item.sell_price ?? '', quantity_on_hand: item.quantity_on_hand ?? 0,
      reorder_point: item.reorder_point ?? 0, reorder_quantity: item.reorder_quantity ?? '', unit_of_measure: item.unit_of_measure || 'unit',
      storage_location: item.storage_location || '', expiry_date: item.expiry_date ? String(item.expiry_date).slice(0, 10) : '',
      active: Number(item.active) === 1,
    })
  }

  async function saveItem() {
    try {
      const payload = {
        ...itemDraft,
        active: itemDraft.active ? 1 : 0,
        quantity_on_hand: Number(itemDraft.quantity_on_hand || 0),
        reorder_point: Number(itemDraft.reorder_point || 0),
      }
      if (itemModal.mode === 'create') await apiPost('/api/inventory/items', payload)
      else await apiPatch(`/api/inventory/items/${itemModal.item.id}`, payload)
      setItemModal(null)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to save inventory item.')
    }
  }

  async function openMovements(item) {
    setMovementModal(item)
    setMovementDraft({ movement_type: 'stock_in', quantity: '', job_id: '', quote_id: '', parts_order_id: '', unit_cost: item.unit_cost ?? '', reference: '', notes: '' })
    try {
      const res = await apiGet(`/api/inventory/items/${item.id}/movements`)
      setMovements(res.movements || [])
    } catch {
      setMovements([])
    }
  }

  async function addMovement() {
    if (!movementModal) return
    try {
      await apiPost(`/api/inventory/items/${movementModal.id}/movements`, {
        ...movementDraft,
        quantity: Number(movementDraft.quantity),
        job_id: movementDraft.job_id ? Number(movementDraft.job_id) : null,
        quote_id: movementDraft.quote_id ? Number(movementDraft.quote_id) : null,
        parts_order_id: movementDraft.parts_order_id ? Number(movementDraft.parts_order_id) : null,
        unit_cost: movementDraft.unit_cost === '' ? null : Number(movementDraft.unit_cost),
      })
      await openMovements(movementModal)
      await load()
    } catch (err) {
      setError(err.message || 'Failed to add movement.')
    }
  }

  async function openSuppliers(item) {
    setSuppliersModal(item)
    setSupplierDraft({ supplier_name: '', supplier_part_number: '', unit_cost: '', lead_time_days: '', preferred: false, active: true })
    try {
      const res = await apiGet(`/api/inventory/items/${item.id}/suppliers`)
      setItemSuppliers(res.suppliers || [])
    } catch {
      setItemSuppliers([])
    }
  }

  async function addSupplier() {
    if (!suppliersModal) return
    try {
      await apiPost(`/api/inventory/items/${suppliersModal.id}/suppliers`, {
        ...supplierDraft,
        unit_cost: supplierDraft.unit_cost === '' ? null : Number(supplierDraft.unit_cost),
        lead_time_days: supplierDraft.lead_time_days === '' ? null : Number(supplierDraft.lead_time_days),
      })
      const res = await apiGet(`/api/inventory/items/${suppliersModal.id}/suppliers`)
      setItemSuppliers(res.suppliers || [])
      setSupplierDraft({ supplier_name: '', supplier_part_number: '', unit_cost: '', lead_time_days: '', preferred: false, active: true })
    } catch (err) {
      setError(err.message || 'Failed to add supplier pricing.')
    }
  }

  async function patchSupplier(row, patch) {
    if (!suppliersModal) return
    try {
      await apiPatch(`/api/inventory/items/${suppliersModal.id}/suppliers/${row.id}`, patch)
      const res = await apiGet(`/api/inventory/items/${suppliersModal.id}/suppliers`)
      setItemSuppliers(res.suppliers || [])
    } catch (err) {
      setError(err.message || 'Failed to update supplier pricing.')
    }
  }

  return (
    <div className="reportsPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Inventory</h2>
          <p className="pageSubtitle">Stock, reorder points, suppliers and movements.</p>
        </div>
        <div className="pageHeaderActions">
          <button type="button" className="primaryButton" onClick={openCreate}>Add Item</button>
          <button type="button" className="secondaryButton" onClick={load}>Refresh</button>
        </div>
      </header>

      {error ? <div className="notice bad">{error}</div> : null}

      <div className="cards" style={{ marginTop: 12 }}>
        <div className="cardBox"><div className="fieldLabel">Total active items</div><div className="kpiValue">{summary?.active_items ?? 0}</div></div>
        <div className="cardBox"><div className="fieldLabel">Low stock items</div><div className="kpiValue">{summary?.low_stock_items ?? 0}</div></div>
        <div className="cardBox"><div className="fieldLabel">Expiring soon</div><div className="kpiValue">{summary?.expiring_soon_items ?? 0}</div></div>
        <div className="cardBox"><div className="fieldLabel">Total stock value</div><div className="kpiValue">{money(summary?.stock_value ?? 0)}</div></div>
        <div className="cardBox"><div className="fieldLabel">Movements this month</div><div className="kpiValue">{summary?.movements_this_month ?? 0}</div></div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="fieldGrid">
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Search</div>
            <input className="input" value={filters.q} onChange={(e) => setFilters((s) => ({ ...s, q: e.target.value }))} placeholder="SKU, name, supplier, location" />
          </div>
          <div className="field" style={{ gridColumn: 'span 3' }}>
            <div className="fieldLabel">Category</div>
            <select className="select" value={filters.category} onChange={(e) => setFilters((s) => ({ ...s, category: e.target.value }))}>
              <option value="">All</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <div className="fieldLabel">Active</div>
            <select className="select" value={filters.active} onChange={(e) => setFilters((s) => ({ ...s, active: e.target.value }))}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="">All</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <div className="fieldLabel">Low stock only</div>
            <label className="inlineToggle"><input type="checkbox" checked={filters.lowStock} onChange={(e) => setFilters((s) => ({ ...s, lowStock: e.target.checked }))} /> Low stock</label>
          </div>
          <div className="field" style={{ gridColumn: 'span 1', display: 'flex', alignItems: 'end' }}>
            <button type="button" className="secondaryButton" onClick={load}>Apply</button>
          </div>
        </div>
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        {loading === 'loading' ? <div className="emptyState">Loading inventory…</div> : null}
        {loading !== 'loading' ? (
          <div className="quoteTableWrap">
            <table className="quoteTable" style={{ minWidth: 1200 }}>
              <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Qty</th><th>Reorder</th><th>Supplier</th><th>Unit cost</th><th>Sell</th><th>Location</th><th>Expiry</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {shownItems.map((item) => {
                  const s = statusMeta(item)
                  return (
                    <tr key={item.id}>
                      <td className="mono">{item.sku || '—'}</td>
                      <td>{item.name}</td>
                      <td>{item.category || '—'}</td>
                      <td>{qty(item.quantity_on_hand)} {item.unit_of_measure}</td>
                      <td>{qty(item.reorder_point)}</td>
                      <td>{item.supplier_name || '—'}</td>
                      <td>{item.unit_cost != null ? money(item.unit_cost) : '—'}</td>
                      <td>{item.sell_price != null ? money(item.sell_price) : '—'}</td>
                      <td>{item.storage_location || '—'}</td>
                      <td>{dateOnly(item.expiry_date)}</td>
                      <td><span className={`statusChip ${s.tone}`}>{s.label}</span></td>
                      <td>
                        <div className="rowActions">
                          <button type="button" className="miniButton" onClick={() => openEdit(item)}>Edit</button>
                          <button type="button" className="miniButton" onClick={() => openMovements(item)}>Movements</button>
                          <button type="button" className="miniButton" onClick={() => openSuppliers(item)}>Suppliers</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {itemModal ? (
        <Modal title={itemModal.mode === 'create' ? 'Add Inventory Item' : `Edit: ${itemModal.item?.name || ''}`} onClose={() => setItemModal(null)}>
          <div className="fieldGrid">
            {[
              ['SKU', 'sku'], ['Name', 'name'], ['Category', 'category'], ['Supplier', 'supplier_name'],
              ['Supplier Part No.', 'supplier_part_number'], ['Unit Cost', 'unit_cost'], ['Sell Price', 'sell_price'], ['Qty On Hand', 'quantity_on_hand'],
              ['Reorder Point', 'reorder_point'], ['Reorder Qty', 'reorder_quantity'], ['Unit', 'unit_of_measure'], ['Storage Location', 'storage_location'],
            ].map(([label, key]) => (
              <div className="field" style={{ gridColumn: 'span 6' }} key={key}><div className="fieldLabel">{label}</div><input className="input" value={itemDraft[key]} onChange={(e) => setItemDraft((s) => ({ ...s, [key]: e.target.value }))} /></div>
            ))}
            <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Expiry Date</div><input className="input" type="date" value={itemDraft.expiry_date} onChange={(e) => setItemDraft((s) => ({ ...s, expiry_date: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Active</div><label className="inlineToggle"><input type="checkbox" checked={!!itemDraft.active} onChange={(e) => setItemDraft((s) => ({ ...s, active: e.target.checked }))} /> Active</label></div>
            <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Description</div><textarea className="textarea" value={itemDraft.description} onChange={(e) => setItemDraft((s) => ({ ...s, description: e.target.value }))} /></div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}><button type="button" className="primaryButton" onClick={saveItem}>Save</button></div>
        </Modal>
      ) : null}

      {movementModal ? (
        <Modal title={`Stock Movements: ${movementModal.name}`} onClose={() => setMovementModal(null)}>
          <div className="quoteTableWrap"><table className="quoteTable"><thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Job</th><th>Ref</th><th>Notes</th></tr></thead><tbody>{movements.map((m) => <tr key={m.id}><td>{dateOnly(m.created_at)}</td><td>{m.movement_type}</td><td>{qty(m.quantity)}</td><td>{m.job_id || '—'}</td><td>{m.reference || '—'}</td><td>{m.notes || '—'}</td></tr>)}</tbody></table></div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Type</div><select className="select" value={movementDraft.movement_type} onChange={(e) => setMovementDraft((s) => ({ ...s, movement_type: e.target.value }))}>{MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Qty</div><input className="input" value={movementDraft.quantity} onChange={(e) => setMovementDraft((s) => ({ ...s, quantity: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Job ID</div><input className="input" value={movementDraft.job_id} onChange={(e) => setMovementDraft((s) => ({ ...s, job_id: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Quote ID</div><input className="input" value={movementDraft.quote_id} onChange={(e) => setMovementDraft((s) => ({ ...s, quote_id: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Parts Order ID</div><input className="input" value={movementDraft.parts_order_id} onChange={(e) => setMovementDraft((s) => ({ ...s, parts_order_id: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Unit Cost</div><input className="input" value={movementDraft.unit_cost} onChange={(e) => setMovementDraft((s) => ({ ...s, unit_cost: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Reference</div><input className="input" value={movementDraft.reference} onChange={(e) => setMovementDraft((s) => ({ ...s, reference: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Notes</div><input className="input" value={movementDraft.notes} onChange={(e) => setMovementDraft((s) => ({ ...s, notes: e.target.value }))} /></div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}><button type="button" className="primaryButton" onClick={addMovement}>Add movement</button></div>
          <div className="fieldHint" style={{ marginTop: 10 }}>Inventory linking can be done from Inventory item movements using optional parts order references.</div>
        </Modal>
      ) : null}

      {suppliersModal ? (
        <Modal title={`Supplier Pricing: ${suppliersModal.name}`} onClose={() => setSuppliersModal(null)}>
          <div className="quoteTableWrap"><table className="quoteTable"><thead><tr><th>Supplier</th><th>Part No.</th><th>Unit Cost</th><th>Lead Time</th><th>Preferred</th><th>Active</th><th></th></tr></thead><tbody>{itemSuppliers.map((s) => <tr key={s.id}><td>{s.supplier_name}</td><td>{s.supplier_part_number || '—'}</td><td>{s.unit_cost != null ? money(s.unit_cost) : '—'}</td><td>{s.lead_time_days != null ? `${s.lead_time_days}d` : '—'}</td><td>{Number(s.preferred) ? 'Yes' : 'No'}</td><td>{Number(s.active) ? 'Yes' : 'No'}</td><td><div className="rowActions"><button type="button" className="miniButton" onClick={() => patchSupplier(s, { preferred: Number(s.preferred) ? 0 : 1 })}>{Number(s.preferred) ? 'Unset Preferred' : 'Set Preferred'}</button><button type="button" className="miniButton" onClick={() => patchSupplier(s, { active: Number(s.active) ? 0 : 1 })}>{Number(s.active) ? 'Deactivate' : 'Activate'}</button></div></td></tr>)}</tbody></table></div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Supplier</div><input className="input" value={supplierDraft.supplier_name} onChange={(e) => setSupplierDraft((s) => ({ ...s, supplier_name: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Part No.</div><input className="input" value={supplierDraft.supplier_part_number} onChange={(e) => setSupplierDraft((s) => ({ ...s, supplier_part_number: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Unit Cost</div><input className="input" value={supplierDraft.unit_cost} onChange={(e) => setSupplierDraft((s) => ({ ...s, unit_cost: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Lead Time (days)</div><input className="input" value={supplierDraft.lead_time_days} onChange={(e) => setSupplierDraft((s) => ({ ...s, lead_time_days: e.target.value }))} /></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Preferred</div><label className="inlineToggle"><input type="checkbox" checked={supplierDraft.preferred} onChange={(e) => setSupplierDraft((s) => ({ ...s, preferred: e.target.checked }))} /> Preferred</label></div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}><button type="button" className="primaryButton" onClick={addSupplier}>Add supplier pricing</button></div>
        </Modal>
      ) : null}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard" style={{ width: 'min(1100px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="modalTitleRow"><h3>{title}</h3><button type="button" className="miniButton" onClick={onClose}>Close</button></div>
        <div>{children}</div>
      </div>
    </div>
  )
}
