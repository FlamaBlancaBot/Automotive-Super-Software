import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { toOperationalUpper } from '../utils/text'

const TABS = [
  { key: 'company', label: 'Company Info' },
  { key: 'technicians', label: 'Technicians' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'services', label: 'Service Templates' },
  { key: 'job-statuses', label: 'Job Statuses' },
  { key: 'items', label: 'Predefined Items' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'branding', label: 'Branding' },
  { key: 'theme', label: 'Theme' },
]

export default function Settings({ onOpenSetup, theme, onThemeChange, userRole }) {
  const [activeTab, setActiveTab] = useState('company')

  const [settings, setSettings] = useState(null)
  const [settingsDraft, setSettingsDraft] = useState(null)
  const [technicians, setTechnicians] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [serviceTemplates, setServiceTemplates] = useState([])
  const [predefinedItems, setPredefinedItems] = useState([])
  const [jobStatuses, setJobStatuses] = useState([])
  const [health, setHealth] = useState(null)
  const [integrationsStatus, setIntegrationsStatus] = useState(null)

  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  const [techDraft, setTechDraft] = useState({ name: '', capabilities: '', active: true })
  const [supplierDraft, setSupplierDraft] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    notes: '',
    usage_quotes: true,
    usage_parts: true,
    usage_mot: true,
    usage_diagnostics: true,
    usage_general: true,
    active: true,
  })
  const [itemDraft, setItemDraft] = useState({
    item_type: 'other',
    name: '',
    description: '',
    default_cost_ex_vat: '',
    default_sell_ex_vat: '',
    default_markup_percent: '',
    vat_rate: '0.2',
    active: true,
  })
  const [modal, setModal] = useState({ type: '', data: null })

  useEffect(() => {
    setDocumentTitle('Settings')
  }, [])

  async function loadAll() {
    setStatus('loading')
    setError('')
    try {
      const [settingsRes, techRes, supplierRes, serviceRes, itemRes, statusesRes, healthRes, integrationsRes] =
        await Promise.all([
          apiGet('/api/admin/company-settings').catch(() => ({ settings: null })),
          apiGet('/api/admin/technicians').catch(() => ({ technicians: [] })),
          apiGet('/api/suppliers').catch(() => ({ suppliers: [] })),
          apiGet('/api/service-templates?include_inactive=true').catch(() => ({ service_templates: [] })),
          apiGet('/api/predefined-quote-items').catch(() => ({ items: [] })),
          apiGet('/api/admin/job-statuses').catch(() => ({ statuses: [] })),
          apiGet('/api/health').catch(() => null),
          apiGet('/api/admin/integrations-status').catch(() => null),
        ])

      setSettings(settingsRes.settings || null)
      setSettingsDraft(settingsRes.settings ? { ...settingsRes.settings } : null)
      setTechnicians(techRes.technicians || [])
      setSuppliers(supplierRes.suppliers || [])
      setServiceTemplates(serviceRes.service_templates || [])
      setPredefinedItems(itemRes.items || [])
      setJobStatuses(statusesRes.statuses || [])
      setHealth(healthRes || null)
      setIntegrationsStatus(integrationsRes || null)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load settings.')
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const canSaveCompany = useMemo(() => {
    return settingsDraft && String(settingsDraft.company_name || '').trim()
  }, [settingsDraft])

  async function saveCompany(overrideDraft = null) {
    const sourceDraft = overrideDraft || settingsDraft
    if (!sourceDraft) return
    setSaveMessage('')
    try {
      const payload = {
        company_name: toOperationalUpper(sourceDraft.company_name),
        trading_name: toOperationalUpper(sourceDraft.trading_name),
        phone: sourceDraft.phone || '',
        email: String(sourceDraft.email || '').trim(),
        address: toOperationalUpper(sourceDraft.address),
        vat_number: toOperationalUpper(sourceDraft.vat_number),
        default_vat_rate: Number(sourceDraft.default_vat_rate || 0.2),
        quote_prefix: toOperationalUpper(sourceDraft.quote_prefix),
        invoice_prefix: toOperationalUpper(sourceDraft.invoice_prefix),
      }
      const res = await apiPatch('/api/admin/company-settings', payload)
      setSettings(res.settings || null)
      setSettingsDraft(res.settings ? { ...res.settings } : null)
      setSaveMessage('Company settings saved.')
    } catch (err) {
      setError(err.message || 'Failed to save company settings.')
    }
  }

  async function addTechnician() {
    if (!techDraft.name.trim()) return
    setSaveMessage('')
    try {
      await apiPost('/api/admin/technicians', {
        name: toOperationalUpper(techDraft.name),
        capabilities: toOperationalUpper(techDraft.capabilities),
        active: techDraft.active ? 1 : 0,
      })
      setTechDraft({ name: '', capabilities: '', active: true })
      const data = await apiGet('/api/admin/technicians')
      setTechnicians(data.technicians || [])
      setSaveMessage('Technician added.')
    } catch (err) {
      setError(err.message || 'Failed to add technician.')
    }
  }

  async function saveTechnicianEdit() {
    if (!modal.data || !modal.data.id) return
    try {
      await apiPatch(`/api/admin/technicians/${modal.data.id}`, {
        name: toOperationalUpper(modal.data.name),
        capabilities: toOperationalUpper(modal.data.capabilities),
        active: modal.data.active ? 1 : 0,
      })
      const data = await apiGet('/api/admin/technicians')
      setTechnicians(data.technicians || [])
      setSaveMessage('Technician updated.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to update technician.')
    }
  }

  async function toggleTechnicianActive(tech) {
    setSaveMessage('')
    try {
      await apiPatch(`/api/admin/technicians/${tech.id}`, {
        active: Number(tech.active) ? 0 : 1,
      })
      const data = await apiGet('/api/admin/technicians')
      setTechnicians(data.technicians || [])
      setSaveMessage('Technician updated.')
    } catch (err) {
      setError(err.message || 'Failed to update technician.')
    }
  }

  async function addSupplier() {
    if (!supplierDraft.name.trim()) return
    setSaveMessage('')
    try {
      await apiPost('/api/suppliers', {
        name: toOperationalUpper(supplierDraft.name),
        contact_name: toOperationalUpper(supplierDraft.contact_name),
        phone: supplierDraft.phone,
        email: supplierDraft.email,
        notes: toOperationalUpper(supplierDraft.notes),
        usage_quotes: supplierDraft.usage_quotes ? 1 : 0,
        usage_parts: supplierDraft.usage_parts ? 1 : 0,
        usage_mot: supplierDraft.usage_mot ? 1 : 0,
        usage_diagnostics: supplierDraft.usage_diagnostics ? 1 : 0,
        usage_general: supplierDraft.usage_general ? 1 : 0,
      })
      setSupplierDraft({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        notes: '',
        usage_quotes: true,
        usage_parts: true,
        usage_mot: true,
        usage_diagnostics: true,
        usage_general: true,
        active: true,
      })
      const data = await apiGet('/api/suppliers')
      setSuppliers(data.suppliers || [])
      setSaveMessage('Supplier added.')
    } catch (err) {
      setError(err.message || 'Failed to add supplier.')
    }
  }

  async function saveSupplierEdit() {
    if (!modal.data || !modal.data.id) return
    try {
      await apiPatch(`/api/suppliers/${modal.data.id}`, {
        ...modal.data,
        name: toOperationalUpper(modal.data.name),
        contact_name: toOperationalUpper(modal.data.contact_name),
        notes: toOperationalUpper(modal.data.notes),
        usage_quotes: modal.data.usage_quotes ? 1 : 0,
        usage_parts: modal.data.usage_parts ? 1 : 0,
        usage_mot: modal.data.usage_mot ? 1 : 0,
        usage_diagnostics: modal.data.usage_diagnostics ? 1 : 0,
        usage_general: modal.data.usage_general ? 1 : 0,
      })
      const data = await apiGet('/api/suppliers')
      setSuppliers(data.suppliers || [])
      setSaveMessage('Supplier updated.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to update supplier.')
    }
  }

  async function toggleSupplierActive(supplier) {
    setSaveMessage('')
    try {
      await apiPatch(`/api/suppliers/${supplier.id}`, {
        active: Number(supplier.active) ? 0 : 1,
      })
      const data = await apiGet('/api/suppliers')
      setSuppliers(data.suppliers || [])
      setSaveMessage('Supplier updated.')
    } catch (err) {
      setError(err.message || 'Failed to update supplier.')
    }
  }

  async function toggleSupplierUsage(supplier, key) {
    setSaveMessage('')
    try {
      await apiPatch(`/api/suppliers/${supplier.id}`, {
        [key]: Number(supplier[key]) ? 0 : 1,
      })
      const data = await apiGet('/api/suppliers')
      setSuppliers(data.suppliers || [])
      setSaveMessage('Supplier usage updated.')
    } catch (err) {
      setError(err.message || 'Failed to update supplier usage.')
    }
  }

  async function addPredefinedItem() {
    if (!itemDraft.name.trim()) return
    setSaveMessage('')
    try {
      await apiPost('/api/predefined-quote-items', {
        item_type: itemDraft.item_type,
        name: toOperationalUpper(itemDraft.name),
        description: toOperationalUpper(itemDraft.description),
        default_cost_ex_vat:
          itemDraft.default_cost_ex_vat === '' ? null : Number(itemDraft.default_cost_ex_vat),
        default_sell_ex_vat:
          itemDraft.default_sell_ex_vat === '' ? null : Number(itemDraft.default_sell_ex_vat),
        default_markup_percent:
          itemDraft.default_markup_percent === '' ? null : Number(itemDraft.default_markup_percent),
        vat_rate: Number(itemDraft.vat_rate || 0.2),
        active: itemDraft.active ? 1 : 0,
      })
      setItemDraft({
        item_type: 'other',
        name: '',
        description: '',
        default_cost_ex_vat: '',
        default_sell_ex_vat: '',
        default_markup_percent: '',
        vat_rate: '0.2',
        active: true,
      })
      const data = await apiGet('/api/predefined-quote-items')
      setPredefinedItems(data.items || [])
      setSaveMessage('Predefined quote item added.')
    } catch (err) {
      setError(err.message || 'Failed to add predefined item.')
    }
  }

  async function savePredefinedItemEdit() {
    if (!modal.data || !modal.data.id) return
    try {
      await apiPatch(`/api/predefined-quote-items/${modal.data.id}`, {
        ...modal.data,
        name: toOperationalUpper(modal.data.name),
        description: toOperationalUpper(modal.data.description),
      })
      const data = await apiGet('/api/predefined-quote-items')
      setPredefinedItems(data.items || [])
      setSaveMessage('Predefined item updated.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to update predefined item.')
    }
  }

  async function togglePredefinedItemActive(item) {
    setSaveMessage('')
    try {
      await apiPatch(`/api/predefined-quote-items/${item.id}`, {
        active: Number(item.active) ? 0 : 1,
      })
      const data = await apiGet('/api/predefined-quote-items')
      setPredefinedItems(data.items || [])
      setSaveMessage('Predefined item updated.')
    } catch (err) {
      setError(err.message || 'Failed to update predefined item.')
    }
  }

  async function toggleServiceTemplateActive(service) {
    setSaveMessage('')
    try {
      await apiPatch(`/api/service-templates/${service.id}`, {
        active: Number(service.active) ? 0 : 1,
      })
      const data = await apiGet('/api/service-templates?include_inactive=true')
      setServiceTemplates(data.service_templates || [])
      setSaveMessage('Service template updated.')
    } catch (err) {
      setError(err.message || 'Failed to update service template.')
    }
  }

  async function addServiceTemplate() {
    const d = modal.data || {}
    if (!String(d.name || '').trim()) return
    try {
      await apiPost('/api/service-templates', {
        name: toOperationalUpper(d.name),
        description: toOperationalUpper(d.description),
        category: toOperationalUpper(d.category),
        fuel_type: toOperationalUpper(d.fuel_type),
        default_duration_minutes:
          (Number(d.default_duration_days || 0) * 8 * 60) +
          (Number(d.default_duration_hours || 0) * 60),
        fixed_price: d.fixed_price === '' ? null : Number(d.fixed_price),
        requires_quote_first: d.requires_quote_first ? 1 : 0,
        is_mot: d.is_mot ? 1 : 0,
        active: d.active ? 1 : 0,
      })
      const data = await apiGet('/api/service-templates?include_inactive=true')
      setServiceTemplates(data.service_templates || [])
      setSaveMessage('Service template added.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to add service template.')
    }
  }

  async function saveServiceTemplateEdit() {
    const d = modal.data || {}
    if (!d.id) return
    try {
      await apiPatch(`/api/service-templates/${d.id}`, {
        name: toOperationalUpper(d.name),
        description: toOperationalUpper(d.description),
        category: toOperationalUpper(d.category),
        fuel_type: toOperationalUpper(d.fuel_type),
        default_duration_minutes:
          (Number(d.default_duration_days || 0) * 8 * 60) +
          (Number(d.default_duration_hours || 0) * 60),
        fixed_price: d.fixed_price === '' ? null : Number(d.fixed_price),
        requires_quote_first: d.requires_quote_first ? 1 : 0,
        is_mot: d.is_mot ? 1 : 0,
        active: d.active ? 1 : 0,
      })
      const data = await apiGet('/api/service-templates?include_inactive=true')
      setServiceTemplates(data.service_templates || [])
      setSaveMessage('Service template updated.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to update service template.')
    }
  }

  async function toggleJobStatus(statusRow, key) {
    setSaveMessage('')
    try {
      await apiPatch(`/api/admin/job-statuses/${statusRow.id}`, {
        [key]: Number(statusRow[key]) ? 0 : 1,
      })
      const data = await apiGet('/api/admin/job-statuses')
      setJobStatuses(data.statuses || [])
      setSaveMessage('Job status updated.')
    } catch (err) {
      setError(err.message || 'Failed to update job status.')
    }
  }

  return (
    <div className="settingsPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Settings</h2>
          <p className="pageSubtitle">Admin foundation for operational setup.</p>
          {userRole !== 'admin' ? (
            <p className="fieldHint">Some write actions are admin-only.</p>
          ) : null}
        </div>
        <span className="setupPill" title="Early foundation">
          Foundation
        </span>
      </header>

      <div className="tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            role="tab"
            aria-selected={activeTab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <div className="notice bad">{error}</div> : null}
      {saveMessage ? <div className="notice good">{saveMessage}</div> : null}

      {status === 'loading' ? <div className="emptyState">Loading…</div> : null}

      {activeTab === 'company' && settingsDraft ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Company Info</h3>
            <div className="fieldHint">Operational defaults</div>
          </div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <Field label="Company name"><div>{settingsDraft.company_name || '—'}</div></Field>
            <Field label="Trading name"><div>{settingsDraft.trading_name || '—'}</div></Field>
            <Field label="Phone"><div>{settingsDraft.phone || '—'}</div></Field>
            <Field label="Email"><div>{settingsDraft.email || '—'}</div></Field>
            <Field label="VAT number"><div>{settingsDraft.vat_number || '—'}</div></Field>
            <Field label="Default VAT rate"><div>{String(settingsDraft.default_vat_rate || 0.2)}</div></Field>
            <Field label="Quote prefix"><div>{settingsDraft.quote_prefix || 'Q'}</div></Field>
            <Field label="Invoice prefix"><div>{settingsDraft.invoice_prefix || 'INV'}</div></Field>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button type="button" className="primaryButton" onClick={() => setModal({ type: 'company-edit', data: { ...settingsDraft } })} disabled={!canSaveCompany}>
              Edit company info
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'technicians' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Technicians</h3>
            <div className="fieldHint">{technicians.length} technician(s)</div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button type="button" className="secondaryButton" onClick={() => setModal({ type: 'technician-add', data: { ...techDraft } })}>
              Add technician
            </button>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr><th>Name</th><th>Capabilities</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {technicians.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.capabilities || '—'}</td>
                    <td>{Number(t.active) ? 'YES' : 'NO'}</td>
                    <td>
                      <button type="button" className="miniButton" onClick={() => setModal({ type: 'technician-edit', data: { ...t, active: Number(t.active) === 1 } })}>Edit</button>{' '}
                      <button type="button" className="miniButton" onClick={() => toggleTechnicianActive(t)}>
                        {Number(t.active) ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'suppliers' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Suppliers</h3>
            <div className="fieldHint">{suppliers.length} supplier(s)</div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button type="button" className="secondaryButton" onClick={() => setModal({ type: 'supplier-add', data: { ...supplierDraft } })}>
              Add supplier
            </button>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>Appears in</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.contact_name || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>
                      <div className="pageHeaderActions" style={{ justifyContent: 'flex-start', gap: 6 }}>
                        <button type="button" className="miniButton" onClick={() => toggleSupplierUsage(s, 'usage_quotes')}>Q:{Number(s.usage_quotes ?? 1) ? 'Y' : 'N'}</button>
                        <button type="button" className="miniButton" onClick={() => toggleSupplierUsage(s, 'usage_parts')}>P:{Number(s.usage_parts ?? 1) ? 'Y' : 'N'}</button>
                        <button type="button" className="miniButton" onClick={() => toggleSupplierUsage(s, 'usage_mot')}>M:{Number(s.usage_mot ?? 1) ? 'Y' : 'N'}</button>
                        <button type="button" className="miniButton" onClick={() => toggleSupplierUsage(s, 'usage_diagnostics')}>D:{Number(s.usage_diagnostics ?? 1) ? 'Y' : 'N'}</button>
                        <button type="button" className="miniButton" onClick={() => toggleSupplierUsage(s, 'usage_general')}>G:{Number(s.usage_general ?? 1) ? 'Y' : 'N'}</button>
                      </div>
                    </td>
                    <td>{Number(s.active) ? 'YES' : 'NO'}</td>
                    <td>
                      <button type="button" className="miniButton" onClick={() => setModal({ type: 'supplier-edit', data: { ...s, usage_quotes: Number(s.usage_quotes ?? 1) === 1, usage_parts: Number(s.usage_parts ?? 1) === 1, usage_mot: Number(s.usage_mot ?? 1) === 1, usage_diagnostics: Number(s.usage_diagnostics ?? 1) === 1, usage_general: Number(s.usage_general ?? 1) === 1, active: Number(s.active) === 1 } })}>Edit</button>{' '}
                      <button type="button" className="miniButton" onClick={() => toggleSupplierActive(s)}>
                        {Number(s.active) ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'services' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Service Templates</h3>
            <div className="fieldHint">{serviceTemplates.length} template(s)</div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button type="button" className="secondaryButton" onClick={() => setModal({ type: 'service-add', data: { name: '', description: '', category: '', fuel_type: '', default_duration_days: 0, default_duration_hours: 1, fixed_price: '', requires_quote_first: false, is_mot: false, active: true } })}>
              Add service template
            </button>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr><th>Name</th><th>Category</th><th>Duration</th><th>Fixed price</th><th>Quote first</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {serviceTemplates.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.category || '—'}</td>
                    <td>{`${Math.floor(Number(s.default_duration_minutes || 0) / 480)}d ${Math.round((Number(s.default_duration_minutes || 0) % 480) / 60)}h`}</td>
                    <td>{s.fixed_price != null ? `£${Number(s.fixed_price).toFixed(2)}` : '—'}</td>
                    <td>{Number(s.requires_quote_first) ? 'YES' : 'NO'}</td>
                    <td>{Number(s.active) ? 'YES' : 'NO'}</td>
                    <td>
                      <button type="button" className="miniButton" onClick={() => setModal({ type: 'service-edit', data: { ...s, default_duration_days: Math.floor(Number(s.default_duration_minutes || 0) / 480), default_duration_hours: Math.round((Number(s.default_duration_minutes || 0) % 480) / 60) } })}>Edit</button>{' '}
                      <button type="button" className="miniButton" onClick={() => toggleServiceTemplateActive(s)}>
                        {Number(s.active) ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'job-statuses' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Job Statuses</h3>
            <div className="fieldHint">{jobStatuses.length} status(es)</div>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr><th>Code</th><th>Label</th><th>Colour</th><th>Calendar</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {jobStatuses.map((s) => (
                  <tr key={s.id}>
                    <td>{s.code}</td>
                    <td>{s.label}</td>
                    <td>{s.colour}</td>
                    <td>{Number(s.appears_on_calendar) ? (Number(s.calendar_active) ? 'Active' : 'Shown') : 'Hidden'}</td>
                    <td>{Number(s.active) ? 'YES' : 'NO'}</td>
                    <td>
                      <div className="pageHeaderActions" style={{ justifyContent: 'flex-start', gap: 6 }}>
                        <button type="button" className="miniButton" onClick={() => toggleJobStatus(s, 'appears_on_calendar')}>Show</button>
                        <button type="button" className="miniButton" onClick={() => toggleJobStatus(s, 'calendar_active')}>Active</button>
                        <button type="button" className="miniButton" onClick={() => toggleJobStatus(s, 'active')}>Enable</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'items' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Predefined Quote Items</h3>
            <div className="fieldHint">{predefinedItems.length} item(s)</div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button type="button" className="secondaryButton" onClick={() => setModal({ type: 'item-add', data: { ...itemDraft } })}>
              Add predefined item
            </button>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr><th>Type</th><th>Name</th><th>Sell ex VAT</th><th>VAT</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {predefinedItems.map((it) => (
                  <tr key={it.id}>
                    <td>{it.item_type}</td>
                    <td>{it.name}</td>
                    <td>{it.default_sell_ex_vat != null ? `£${Number(it.default_sell_ex_vat).toFixed(2)}` : '—'}</td>
                    <td>{it.vat_rate}</td>
                    <td>{Number(it.active) ? 'YES' : 'NO'}</td>
                    <td>
                      <button type="button" className="miniButton" onClick={() => setModal({ type: 'item-edit', data: { ...it, active: Number(it.active) === 1 } })}>Edit</button>{' '}
                      <button type="button" className="miniButton" onClick={() => togglePredefinedItemActive(it)}>
                        {Number(it.active) ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'accounting' && settingsDraft ? (
        <SimpleTable
          title="Accounting"
          columns={['Setting', 'Value']}
          rows={[
            ['Default VAT rate', String(settingsDraft.default_vat_rate || 0.2)],
            ['Quote prefix', settingsDraft.quote_prefix || 'Q'],
            ['Invoice prefix', settingsDraft.invoice_prefix || 'INV'],
          ]}
        />
      ) : null}

      {activeTab === 'integrations' ? (
        <SimpleTable
          title="Integrations / Webhooks"
          columns={['Integration', 'Status']}
          rows={[
            [
              'n8n vehicle lookup',
              integrationsStatus?.integrations?.n8n_vehicle_lookup
                ? 'Configured'
                : health?.ok
                  ? 'Not configured'
                  : 'Check backend health',
            ],
            ['SMS provider', 'Placeholder'],
            ['Stripe', 'Placeholder'],
            ['Dojo', 'Placeholder'],
          ]}
        />
      ) : null}

      {activeTab === 'branding' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Branding</h3>
            <div className="fieldHint">Upload management is TODO.</div>
          </div>
          <div className="fieldHint" style={{ marginTop: 12 }}>
            Current placeholders: `public/brand/A.S.S - Logo.png` and `public/A.S.S - Favicon.png`.
          </div>
          <div className="brandLogoPreview" style={{ marginTop: 12 }}>
            <img src="/brand/logo.png" alt="" style={{ width: 56, height: 56, borderRadius: 10, border: '1px solid var(--separator)' }} />
            <span className="fieldHint">Logo/favicon upload UI will be added here later.</span>
          </div>
          <div className="notice bad" style={{ marginTop: 12 }}>
            This build uses temporary passwordless testing access. Do not use for real staff/customer data.
          </div>
        </div>
      ) : null}

      {activeTab === 'theme' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Theme</h3>
            <div className="fieldHint">Stored in localStorage for now.</div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className={`secondaryButton ${theme === 'dark' ? 'activeTheme' : ''}`}
              onClick={() => onThemeChange && onThemeChange('dark')}
            >
              Dark
            </button>
            <button
              type="button"
              className={`secondaryButton ${theme === 'light' ? 'activeTheme' : ''}`}
              onClick={() => onThemeChange && onThemeChange('light')}
            >
              Light
            </button>
            <button type="button" className="secondaryButton" onClick={() => onOpenSetup && onOpenSetup()}>
              Open Set-up
            </button>
          </div>
        </div>
      ) : null}

      {modal.type ? (
        <SettingsModal modal={modal} setModal={setModal}>
          {modal.type === 'company-edit' ? (
            <>
              <h3 className="cardTitle">Edit company info</h3>
              <SettingsFormCompany draft={modal.data} setDraft={(fn) => setModal((m) => ({ ...m, data: typeof fn === 'function' ? fn(m.data) : fn }))} />
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={async () => { await saveCompany(modal.data); setModal({ type: '', data: null }) }}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'technician-add' || modal.type === 'technician-edit' ? (
            <>
              <h3 className="cardTitle">{modal.type === 'technician-add' ? 'Add technician' : 'Edit technician'}</h3>
              <Field label="Name"><input className="input" value={modal.data.name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} /></Field>
              <Field label="Capabilities"><input className="input" value={modal.data.capabilities || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, capabilities: e.target.value } }))} /></Field>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={modal.type === 'technician-add' ? async () => { setTechDraft(modal.data); await addTechnician(); setModal({ type: '', data: null }) } : saveTechnicianEdit}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'supplier-add' || modal.type === 'supplier-edit' ? (
            <>
              <h3 className="cardTitle">{modal.type === 'supplier-add' ? 'Add supplier' : 'Edit supplier'}</h3>
              <Field label="Supplier name"><input className="input" value={modal.data.name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} /></Field>
              <Field label="Contact name"><input className="input" value={modal.data.contact_name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, contact_name: e.target.value } }))} /></Field>
              <Field label="Phone"><input className="input" value={modal.data.phone || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, phone: e.target.value } }))} /></Field>
              <Field label="Email"><input className="input" value={modal.data.email || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, email: e.target.value } }))} /></Field>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={modal.type === 'supplier-add' ? async () => { setSupplierDraft(modal.data); await addSupplier(); setModal({ type: '', data: null }) } : saveSupplierEdit}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'service-add' || modal.type === 'service-edit' ? (
            <>
              <h3 className="cardTitle">{modal.type === 'service-add' ? 'Add service template' : 'Edit service template'}</h3>
              <Field label="Name"><input className="input" value={modal.data.name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} /></Field>
              <Field label="Description"><textarea className="textarea" value={modal.data.description || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
              <Field label="Default duration (days)"><input className="input" value={modal.data.default_duration_days ?? 0} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, default_duration_days: e.target.value } }))} /></Field>
              <Field label="Default duration (hours)"><input className="input" value={modal.data.default_duration_hours ?? 1} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, default_duration_hours: e.target.value } }))} /></Field>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={modal.type === 'service-add' ? addServiceTemplate : saveServiceTemplateEdit}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'item-add' || modal.type === 'item-edit' ? (
            <>
              <h3 className="cardTitle">{modal.type === 'item-add' ? 'Add predefined item' : 'Edit predefined item'}</h3>
              <Field label="Type"><select className="select" value={modal.data.item_type || 'other'} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, item_type: e.target.value } }))}><option value="labour">labour</option><option value="part">part</option><option value="diagnostic">diagnostic</option><option value="mot_repair">mot_repair</option><option value="oil">oil</option><option value="service_item">service_item</option><option value="other">other</option></select></Field>
              <Field label="Name"><input className="input" value={modal.data.name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} /></Field>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={modal.type === 'item-add' ? async () => { setItemDraft(modal.data); await addPredefinedItem(); setModal({ type: '', data: null }) } : savePredefinedItemEdit}>Save</button></div>
            </>
          ) : null}
        </SettingsModal>
      ) : null}
    </div>
  )
}

function SettingsModal({ modal, setModal, children }) {
  return (
    <div className="modalOverlay" onClick={() => setModal({ type: '', data: null })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="pageHeaderActions" style={{ justifyContent: 'space-between' }}>
          <span className="fieldHint">Modal form</span>
          <button type="button" className="secondaryButton" onClick={() => setModal({ type: '', data: null })}>Close</button>
        </div>
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>{children}</div>
      </div>
    </div>
  )
}

function SettingsFormCompany({ draft, setDraft }) {
  return (
    <div className="fieldGrid">
      <Field label="Company name"><input className="input" value={draft.company_name || ''} onChange={(e) => setDraft((s) => ({ ...s, company_name: e.target.value }))} /></Field>
      <Field label="Trading name"><input className="input" value={draft.trading_name || ''} onChange={(e) => setDraft((s) => ({ ...s, trading_name: e.target.value }))} /></Field>
      <Field label="Phone"><input className="input" value={draft.phone || ''} onChange={(e) => setDraft((s) => ({ ...s, phone: e.target.value }))} /></Field>
      <Field label="Email"><input className="input" value={draft.email || ''} onChange={(e) => setDraft((s) => ({ ...s, email: e.target.value }))} /></Field>
      <Field label="VAT number"><input className="input" value={draft.vat_number || ''} onChange={(e) => setDraft((s) => ({ ...s, vat_number: e.target.value }))} /></Field>
      <Field label="Default VAT rate"><input className="input" value={String(draft.default_vat_rate || 0.2)} onChange={(e) => setDraft((s) => ({ ...s, default_vat_rate: e.target.value }))} /></Field>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field">
      <div className="fieldLabel">{label}</div>
      {children}
    </div>
  )
}

function SimpleTable({ title, columns, rows }) {
  return (
    <div className="cardBox">
      <div className="cardTop">
        <h3 className="cardTitle">{title}</h3>
      </div>
      <div className="quoteTableWrap" style={{ marginTop: 12 }}>
        <table className="quoteTable">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                {row.map((cell, i) => (
                  <td key={`${idx}-${i}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
