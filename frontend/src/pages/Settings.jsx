import { useEffect, useMemo, useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { toOperationalUpper } from '../utils/text'

const TABS = [
  { key: 'company', label: 'Company Info' },
  { key: 'technicians', label: 'Technicians' },
  { key: 'bays', label: 'Bays' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'services', label: 'Service Templates' },
  { key: 'job-statuses', label: 'Job Statuses' },
  { key: 'items', label: 'Predefined Items' },
  { key: 'templates', label: 'Templates' },
  { key: 'mot-automation', label: 'MOT Automation' },
  { key: 'notifications', label: 'Notifications & Reminders' },
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
  const [skills, setSkills] = useState([])
  const [skillsByTech, setSkillsByTech] = useState({})
  const [bays, setBays] = useState([])
  const [bayTechniciansByBay, setBayTechniciansByBay] = useState({})
  const [suppliers, setSuppliers] = useState([])
  const [serviceTemplates, setServiceTemplates] = useState([])
  const [predefinedItems, setPredefinedItems] = useState([])
  const [jobStatuses, setJobStatuses] = useState([])
  const [templates, setTemplates] = useState([])
  const [shortcodeHelp, setShortcodeHelp] = useState(null)
  const [health, setHealth] = useState(null)
  const [integrationsStatus, setIntegrationsStatus] = useState(null)
  const [motAutomation, setMotAutomation] = useState({
    webhook_url: '',
    first_check_delay_minutes: 45,
    retry_delay_1_minutes: 10,
    retry_delay_2_minutes: 10,
    retry_delay_3_minutes: 5,
    delayed_retry_minutes: 20,
    max_checks_per_mot: 20,
    scheduler_enabled: true,
    scheduler_interval_seconds: 60,
  })
  const [notificationPrefs, setNotificationPrefs] = useState({
    sound_enabled: true,
    default_reminder_lead_minutes: 30,
    unread_behaviour: 'highlight',
  })

  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  const [techDraft, setTechDraft] = useState({ name: '', email: '', phone: '', role: '', skills_notes: '', capabilities: '', active: true })
  const [skillDraft, setSkillDraft] = useState({ name: '', description: '', active: true })
  const [bayDraft, setBayDraft] = useState({ name: '', bay_type: 'general', description: '', active: true, is_mot_bay: false })
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
      const [settingsRes, techRes, skillsRes, baysRes, supplierRes, serviceRes, itemRes, statusesRes, healthRes, integrationsRes, templatesRes, motSettingsRes, notifSettingsRes] =
        await Promise.all([
          apiGet('/api/admin/company-settings').catch(() => ({ settings: null })),
          apiGet('/api/admin/technicians').catch(() => ({ technicians: [] })),
          apiGet('/api/technician-skills').catch(() => ({ skills: [] })),
          apiGet('/api/bays').catch(() => ({ bays: [] })),
          apiGet('/api/suppliers').catch(() => ({ suppliers: [] })),
          apiGet('/api/service-templates?include_inactive=true').catch(() => ({ service_templates: [] })),
          apiGet('/api/predefined-quote-items').catch(() => ({ items: [] })),
          apiGet('/api/admin/job-statuses').catch(() => ({ statuses: [] })),
          apiGet('/api/health').catch(() => null),
          apiGet('/api/admin/integrations-status').catch(() => null),
          apiGet('/api/templates').catch(() => ({ templates: [], shortcode_help: null })),
          apiGet('/api/mot/settings').catch(() => ({ settings: null })),
          apiGet('/api/settings/notifications').catch(() => ({ settings: null })),
        ])

      setSettings(settingsRes.settings || null)
      setSettingsDraft(settingsRes.settings ? { ...settingsRes.settings } : null)
      setTechnicians(techRes.technicians || [])
      setSkills(skillsRes.skills || [])
      setBays(baysRes.bays || [])
      setSuppliers(supplierRes.suppliers || [])
      setServiceTemplates(serviceRes.service_templates || [])
      setPredefinedItems(itemRes.items || [])
      setJobStatuses(statusesRes.statuses || [])
      setHealth(healthRes || null)
      setIntegrationsStatus(integrationsRes || null)
      setTemplates(templatesRes.templates || [])
      setShortcodeHelp(templatesRes.shortcode_help || null)
      if (motSettingsRes && motSettingsRes.settings) {
        setMotAutomation((prev) => ({ ...prev, ...motSettingsRes.settings }))
      }
      if (notifSettingsRes && notifSettingsRes.settings) {
        setNotificationPrefs((prev) => ({ ...prev, ...notifSettingsRes.settings }))
      }

      const techList = techRes.technicians || []
      const bayList = baysRes.bays || []
      const [skillsAssignments, bayAssignments] = await Promise.all([
        Promise.all(
          techList.map(async (t) => {
            const out = await apiGet(`/api/technicians/${t.id}/skills`).catch(() => ({ assignments: [] }))
            return [t.id, out.assignments || []]
          }),
        ),
        Promise.all(
          bayList.map(async (b) => {
            const out = await apiGet(`/api/bays/${b.id}/technicians`).catch(() => ({ assignments: [] }))
            return [b.id, out.assignments || []]
          }),
        ),
      ])
      setSkillsByTech(Object.fromEntries(skillsAssignments))
      setBayTechniciansByBay(Object.fromEntries(bayAssignments))
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

  async function reloadTechniciansAndAssignments() {
    const techData = await apiGet('/api/admin/technicians')
    const techRows = techData.technicians || []
    setTechnicians(techRows)
    const assignments = await Promise.all(
      techRows.map(async (t) => {
        const out = await apiGet(`/api/technicians/${t.id}/skills`).catch(() => ({ assignments: [] }))
        return [t.id, out.assignments || []]
      }),
    )
    setSkillsByTech(Object.fromEntries(assignments))
  }

  async function reloadSkills() {
    const data = await apiGet('/api/technician-skills')
    setSkills(data.skills || [])
  }

  async function reloadBaysAndAssignments() {
    const bayData = await apiGet('/api/bays')
    const bayRows = bayData.bays || []
    setBays(bayRows)
    const assignments = await Promise.all(
      bayRows.map(async (b) => {
        const out = await apiGet(`/api/bays/${b.id}/technicians`).catch(() => ({ assignments: [] }))
        return [b.id, out.assignments || []]
      }),
    )
    setBayTechniciansByBay(Object.fromEntries(assignments))
  }

  async function addTechnician(draft) {
    const input = draft || techDraft
    if (!String(input.name || '').trim()) {
      setError('Technician name is required.')
      return false
    }
    setSaveMessage('')
    try {
      await apiPost('/api/admin/technicians', {
        name: String(input.name || '').trim(),
        email: String(input.email || '').trim(),
        phone: input.phone || '',
        role: String(input.role || '').trim(),
        skills_notes: String(input.skills_notes || '').trim(),
        capabilities: String(input.capabilities || '').trim(),
        active: input.active === false ? 0 : 1,
      })
      setTechDraft({ name: '', email: '', phone: '', role: '', skills_notes: '', capabilities: '', active: true })
      await reloadTechniciansAndAssignments()
      setSaveMessage('Technician added.')
      return true
    } catch (err) {
      setError(err.message || 'Failed to add technician.')
      return false
    }
  }

  async function saveTechnicianEdit() {
    if (!modal.data || !modal.data.id) return
    try {
      await apiPatch(`/api/admin/technicians/${modal.data.id}`, {
        name: String(modal.data.name || '').trim(),
        email: String(modal.data.email || '').trim(),
        phone: modal.data.phone || '',
        role: String(modal.data.role || '').trim(),
        skills_notes: String(modal.data.skills_notes || '').trim(),
        capabilities: String(modal.data.capabilities || '').trim(),
        active: modal.data.active ? 1 : 0,
      })
      await reloadTechniciansAndAssignments()
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
      await reloadTechniciansAndAssignments()
      setSaveMessage('Technician updated.')
    } catch (err) {
      setError(err.message || 'Failed to update technician.')
    }
  }

  async function addSkill(draft) {
    const input = draft || skillDraft
    if (!String(input.name || '').trim()) {
      setError('Skill name is required.')
      return false
    }
    try {
      await apiPost('/api/technician-skills', {
        name: String(input.name || '').trim(),
        description: String(input.description || '').trim(),
        active: input.active === false ? 0 : 1,
      })
      setSkillDraft({ name: '', description: '', active: true })
      await reloadSkills()
      setSaveMessage('Skill added.')
      return true
    } catch (err) {
      setError(err.message || 'Failed to add skill.')
      return false
    }
  }

  async function saveSkillEdit() {
    if (!modal.data || !modal.data.id) return
    try {
      await apiPatch(`/api/technician-skills/${modal.data.id}`, {
        name: String(modal.data.name || '').trim(),
        description: String(modal.data.description || '').trim(),
        active: modal.data.active ? 1 : 0,
      })
      await reloadSkills()
      setSaveMessage('Skill updated.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to update skill.')
    }
  }

  async function assignSkillToTechnician(technicianId, skillId, level = '', notes = '') {
    if (!technicianId || !skillId) return
    try {
      await apiPost(`/api/technicians/${technicianId}/skills`, { skill_id: skillId, level, notes })
      await reloadTechniciansAndAssignments()
      setSaveMessage('Skill assigned.')
    } catch (err) {
      setError(err.message || 'Failed to assign skill.')
    }
  }

  async function removeSkillFromTechnician(technicianId, assignmentId) {
    try {
      await apiDelete(`/api/technicians/${technicianId}/skills/${assignmentId}`)
      await reloadTechniciansAndAssignments()
      setSaveMessage('Skill removed.')
    } catch (err) {
      setError(err.message || 'Failed to remove skill.')
    }
  }

  async function addBay(draft) {
    const input = draft || bayDraft
    if (!String(input.name || '').trim()) {
      setError('Bay name is required.')
      return false
    }
    try {
      await apiPost('/api/bays', {
        name: String(input.name || '').trim(),
        bay_type: String(input.bay_type || 'general').trim().toLowerCase(),
        description: String(input.description || '').trim(),
        active: input.active === false ? 0 : 1,
        is_mot_bay: input.is_mot_bay ? 1 : 0,
      })
      setBayDraft({ name: '', bay_type: 'general', description: '', active: true, is_mot_bay: false })
      await reloadBaysAndAssignments()
      setSaveMessage('Bay added.')
      return true
    } catch (err) {
      setError(err.message || 'Failed to add bay.')
      return false
    }
  }

  async function saveBayEdit() {
    if (!modal.data || !modal.data.id) return
    try {
      await apiPatch(`/api/bays/${modal.data.id}`, {
        name: String(modal.data.name || '').trim(),
        bay_type: String(modal.data.bay_type || 'general').trim().toLowerCase(),
        description: String(modal.data.description || '').trim(),
        active: modal.data.active ? 1 : 0,
        is_mot_bay: modal.data.is_mot_bay ? 1 : 0,
      })
      await reloadBaysAndAssignments()
      setSaveMessage('Bay updated.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to update bay.')
    }
  }

  async function toggleBayActive(bay) {
    try {
      await apiPatch(`/api/bays/${bay.id}`, { active: Number(bay.active) ? 0 : 1 })
      await reloadBaysAndAssignments()
      setSaveMessage('Bay updated.')
    } catch (err) {
      setError(err.message || 'Failed to update bay.')
    }
  }

  async function assignTechnicianToBay(bayId, technicianId) {
    if (!bayId || !technicianId) return
    try {
      await apiPost(`/api/bays/${bayId}/technicians`, { technician_id: technicianId })
      await reloadBaysAndAssignments()
      setSaveMessage('Technician assigned to bay.')
    } catch (err) {
      setError(err.message || 'Failed to assign technician to bay.')
    }
  }

  async function removeTechnicianFromBay(bayId, assignmentId) {
    try {
      await apiDelete(`/api/bays/${bayId}/technicians/${assignmentId}`)
      await reloadBaysAndAssignments()
      setSaveMessage('Technician removed from bay.')
    } catch (err) {
      setError(err.message || 'Failed to remove bay technician.')
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

  async function saveTemplateEdit() {
    if (!modal.data || !modal.data.template_key) return
    try {
      const payload = {
        name: modal.data.name,
        subject: modal.data.subject,
        body_html: modal.data.body_html,
        body_text: modal.data.body_text,
        active: modal.data.active ? 1 : 0,
      }
      await apiPatch(`/api/templates/${modal.data.template_key}`, payload)
      const data = await apiGet('/api/templates')
      setTemplates(data.templates || [])
      setShortcodeHelp(data.shortcode_help || null)
      setSaveMessage('Template updated.')
      setModal({ type: '', data: null })
    } catch (err) {
      setError(err.message || 'Failed to update template.')
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
                <tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Skills/Notes</th><th>Skill assignments</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {technicians.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.role || '—'}</td>
                    <td>{t.phone || '—'}</td>
                    <td>{t.email || '—'}</td>
                    <td>{t.skills_notes || t.capabilities || '—'}</td>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div className="fieldHint">
                          {(skillsByTech[t.id] || []).length
                            ? (skillsByTech[t.id] || []).map((s) => `${s.skill_name}${s.level ? ` (${s.level})` : ''}`).join(', ')
                            : 'No skills assigned'}
                        </div>
                        <div className="pageHeaderActions" style={{ justifyContent: 'flex-start', gap: 6 }}>
                          <button type="button" className="miniButton" onClick={() => setModal({ type: 'technician-skill-add', data: { technician_id: t.id, skill_id: '', level: 'intermediate', notes: '' } })}>Assign</button>
                          {(skillsByTech[t.id] || []).map((s) => (
                            <button key={s.id} type="button" className="miniButton" onClick={() => removeSkillFromTechnician(t.id, s.id)}>
                              Remove {s.skill_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
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

          <div className="cardTop" style={{ marginTop: 20 }}>
            <h3 className="cardTitle">Technician Skills</h3>
            <div className="fieldHint">{skills.length} skill(s)</div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button type="button" className="secondaryButton" onClick={() => setModal({ type: 'skill-add', data: { ...skillDraft } })}>
              Add skill
            </button>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr><th>Name</th><th>Description</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.description || '—'}</td>
                    <td>{Number(s.active) ? 'YES' : 'NO'}</td>
                    <td>
                      <button type="button" className="miniButton" onClick={() => setModal({ type: 'skill-edit', data: { ...s, active: Number(s.active) === 1 } })}>Edit</button>{' '}
                      <button type="button" className="miniButton" onClick={() => apiPatch(`/api/technician-skills/${s.id}`, { active: Number(s.active) ? 0 : 1 }).then(reloadSkills).catch((err) => setError(err.message || 'Failed to update skill.'))}>
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

      {activeTab === 'bays' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Workshop Bays</h3>
            <div className="fieldHint">{bays.length} bay(s)</div>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button type="button" className="secondaryButton" onClick={() => setModal({ type: 'bay-add', data: { ...bayDraft } })}>
              Add bay
            </button>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead>
                <tr><th>Name</th><th>Type</th><th>MOT bay</th><th>Description</th><th>Technicians</th><th>Active</th><th></th></tr>
              </thead>
              <tbody>
                {bays.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{b.bay_type}</td>
                    <td>{Number(b.is_mot_bay) ? 'YES' : 'NO'}</td>
                    <td>{b.description || '—'}</td>
                    <td>
                      <div className="fieldHint">
                        {(bayTechniciansByBay[b.id] || []).filter((x) => Number(x.active) === 1).map((x) => x.technician_name).join(', ') || 'None'}
                      </div>
                      <div className="pageHeaderActions" style={{ justifyContent: 'flex-start', gap: 6 }}>
                        <button type="button" className="miniButton" onClick={() => setModal({ type: 'bay-tech-add', data: { bay_id: b.id, technician_id: '' } })}>Assign</button>
                        {(bayTechniciansByBay[b.id] || []).filter((x) => Number(x.active) === 1).map((x) => (
                          <button key={x.id} type="button" className="miniButton" onClick={() => removeTechnicianFromBay(b.id, x.id)}>
                            Remove {x.technician_name}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>{Number(b.active) ? 'YES' : 'NO'}</td>
                    <td>
                      <button type="button" className="miniButton" onClick={() => setModal({ type: 'bay-edit', data: { ...b, active: Number(b.active) === 1, is_mot_bay: Number(b.is_mot_bay) === 1 } })}>Edit</button>{' '}
                      <button type="button" className="miniButton" onClick={() => toggleBayActive(b)}>
                        {Number(b.active) ? 'Deactivate' : 'Activate'}
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

      {activeTab === 'templates' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Document Templates</h3>
            <div className="fieldHint">{templates.length} template(s)</div>
          </div>
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead><tr><th>Key</th><th>Type</th><th>Name</th><th>Active</th><th></th></tr></thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.template_key}>
                    <td className="mono">{t.template_key}</td>
                    <td>{t.template_type}</td>
                    <td>{t.name}</td>
                    <td>{Number(t.active) ? 'YES' : 'NO'}</td>
                    <td><button type="button" className="miniButton" onClick={async () => { const out = await apiGet(`/api/templates/${t.template_key}`); setModal({ type: 'template-edit', data: { ...out.template, active: Number(out.template.active) === 1 } }) }}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'mot-automation' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">MOT Automation</h3>
            <div className="fieldHint">Webhook and polling timings for automated MOT result checks.</div>
          </div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <Field label="Webhook URL"><input className="input" value={motAutomation.webhook_url || ''} onChange={(e) => setMotAutomation((s) => ({ ...s, webhook_url: e.target.value }))} /></Field>
            <Field label="First check delay (minutes)"><input className="input" value={motAutomation.first_check_delay_minutes ?? 45} onChange={(e) => setMotAutomation((s) => ({ ...s, first_check_delay_minutes: e.target.value }))} /></Field>
            <Field label="Retry delay 1 (minutes)"><input className="input" value={motAutomation.retry_delay_1_minutes ?? 10} onChange={(e) => setMotAutomation((s) => ({ ...s, retry_delay_1_minutes: e.target.value }))} /></Field>
            <Field label="Retry delay 2 (minutes)"><input className="input" value={motAutomation.retry_delay_2_minutes ?? 10} onChange={(e) => setMotAutomation((s) => ({ ...s, retry_delay_2_minutes: e.target.value }))} /></Field>
            <Field label="Retry delay 3 (minutes)"><input className="input" value={motAutomation.retry_delay_3_minutes ?? 5} onChange={(e) => setMotAutomation((s) => ({ ...s, retry_delay_3_minutes: e.target.value }))} /></Field>
            <Field label="Delayed retry (minutes)"><input className="input" value={motAutomation.delayed_retry_minutes ?? 20} onChange={(e) => setMotAutomation((s) => ({ ...s, delayed_retry_minutes: e.target.value }))} /></Field>
            <Field label="Max checks per MOT"><input className="input" value={motAutomation.max_checks_per_mot ?? 20} onChange={(e) => setMotAutomation((s) => ({ ...s, max_checks_per_mot: e.target.value }))} /></Field>
            <Field label="Scheduler interval (seconds)"><input className="input" value={motAutomation.scheduler_interval_seconds ?? 60} onChange={(e) => setMotAutomation((s) => ({ ...s, scheduler_interval_seconds: e.target.value }))} /></Field>
            <Field label="Scheduler enabled"><label className="inlineCheck"><input type="checkbox" checked={Boolean(motAutomation.scheduler_enabled)} onChange={(e) => setMotAutomation((s) => ({ ...s, scheduler_enabled: e.target.checked }))} /><span>Enable scheduler</span></label></Field>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primaryButton"
              onClick={async () => {
                try {
                  const out = await apiPatch('/api/mot/settings', motAutomation)
                  if (out && out.settings) setMotAutomation((prev) => ({ ...prev, ...out.settings }))
                  setSaveMessage('MOT automation settings saved.')
                } catch (err) {
                  setError(err.message || 'Failed to save MOT automation settings.')
                }
              }}
            >
              Save MOT automation settings
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'notifications' ? (
        <div className="cardBox">
          <div className="cardTop">
            <h3 className="cardTitle">Notifications & Reminders</h3>
            <div className="fieldHint">Basic platform notification and reminder preferences foundation.</div>
          </div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <Field label="Notification sound enabled">
              <label className="inlineCheck"><input type="checkbox" checked={Boolean(notificationPrefs.sound_enabled)} onChange={(e) => setNotificationPrefs((s) => ({ ...s, sound_enabled: e.target.checked }))} /><span>Play sound for new high-priority notifications</span></label>
            </Field>
            <Field label="Default reminder lead (minutes)">
              <input className="input" value={notificationPrefs.default_reminder_lead_minutes ?? 30} onChange={(e) => setNotificationPrefs((s) => ({ ...s, default_reminder_lead_minutes: e.target.value }))} />
            </Field>
            <Field label="Unread behaviour">
              <select className="select" value={notificationPrefs.unread_behaviour || 'highlight'} onChange={(e) => setNotificationPrefs((s) => ({ ...s, unread_behaviour: e.target.value }))}>
                <option value="highlight">highlight</option>
                <option value="count_only">count_only</option>
              </select>
            </Field>
          </div>
          <div className="pageHeaderActions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="primaryButton"
              onClick={async () => {
                try {
                  const out = await apiPatch('/api/settings/notifications', notificationPrefs)
                  if (out && out.settings) setNotificationPrefs((prev) => ({ ...prev, ...out.settings }))
                  setSaveMessage('Notification settings saved.')
                } catch (err) {
                  setError(err.message || 'Failed to save notification settings.')
                }
              }}
            >
              Save notification settings
            </button>
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
              <Field label="Role / title"><input className="input" value={modal.data.role || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, role: e.target.value } }))} /></Field>
              <Field label="Email"><input className="input" value={modal.data.email || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, email: e.target.value } }))} /></Field>
              <Field label="Phone"><input className="input" value={modal.data.phone || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, phone: e.target.value } }))} /></Field>
              <Field label="Skills / notes"><textarea className="textarea" rows={4} value={modal.data.skills_notes || modal.data.capabilities || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, skills_notes: e.target.value, capabilities: e.target.value } }))} /></Field>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={modal.type === 'technician-add' ? async () => { const ok = await addTechnician(modal.data); if (ok) setModal({ type: '', data: null }) } : saveTechnicianEdit}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'skill-add' || modal.type === 'skill-edit' ? (
            <>
              <h3 className="cardTitle">{modal.type === 'skill-add' ? 'Add skill' : 'Edit skill'}</h3>
              <Field label="Name"><input className="input" value={modal.data.name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} /></Field>
              <Field label="Description"><textarea className="textarea" rows={4} value={modal.data.description || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
              {modal.type === 'skill-edit' ? (
                <label className="inlineCheck"><input type="checkbox" checked={Boolean(modal.data.active)} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, active: e.target.checked } }))} /><span>Active</span></label>
              ) : null}
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={modal.type === 'skill-add' ? async () => { const ok = await addSkill(modal.data); if (ok) setModal({ type: '', data: null }) } : saveSkillEdit}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'technician-skill-add' ? (
            <>
              <h3 className="cardTitle">Assign Skill</h3>
              <Field label="Skill">
                <select className="select" value={modal.data.skill_id || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, skill_id: e.target.value } }))}>
                  <option value="">Select skill…</option>
                  {skills.filter((s) => Number(s.active) === 1).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Level">
                <select className="select" value={modal.data.level || 'intermediate'} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, level: e.target.value } }))}>
                  <option value="beginner">beginner</option>
                  <option value="intermediate">intermediate</option>
                  <option value="advanced">advanced</option>
                  <option value="specialist">specialist</option>
                </select>
              </Field>
              <Field label="Notes"><textarea className="textarea" rows={3} value={modal.data.notes || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, notes: e.target.value } }))} /></Field>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={async () => { await assignSkillToTechnician(modal.data.technician_id, Number(modal.data.skill_id), modal.data.level, modal.data.notes); setModal({ type: '', data: null }) }}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'bay-add' || modal.type === 'bay-edit' ? (
            <>
              <h3 className="cardTitle">{modal.type === 'bay-add' ? 'Add bay' : 'Edit bay'}</h3>
              <Field label="Name"><input className="input" value={modal.data.name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} /></Field>
              <Field label="Bay type">
                <select className="select" value={modal.data.bay_type || 'general'} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, bay_type: e.target.value } }))}>
                  <option value="general">general</option><option value="mot">mot</option><option value="diagnostic">diagnostic</option><option value="engine">engine</option><option value="storage">storage</option><option value="other">other</option>
                </select>
              </Field>
              <Field label="Description"><textarea className="textarea" rows={3} value={modal.data.description || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, description: e.target.value } }))} /></Field>
              <label className="inlineCheck"><input type="checkbox" checked={Boolean(modal.data.active)} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, active: e.target.checked } }))} /><span>Active</span></label>
              <label className="inlineCheck"><input type="checkbox" checked={Boolean(modal.data.is_mot_bay)} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, is_mot_bay: e.target.checked } }))} /><span>Internal MOT bay</span></label>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={modal.type === 'bay-add' ? async () => { const ok = await addBay(modal.data); if (ok) setModal({ type: '', data: null }) } : saveBayEdit}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'bay-tech-add' ? (
            <>
              <h3 className="cardTitle">Assign Technician To Bay</h3>
              <Field label="Technician">
                <select className="select" value={modal.data.technician_id || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, technician_id: e.target.value } }))}>
                  <option value="">Select technician…</option>
                  {technicians.filter((t) => Number(t.active) === 1).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={async () => { await assignTechnicianToBay(modal.data.bay_id, Number(modal.data.technician_id)); setModal({ type: '', data: null }) }}>Save</button></div>
            </>
          ) : null}
          {modal.type === 'template-edit' ? (
            <>
              <h3 className="cardTitle">Edit template</h3>
              <Field label="Name"><input className="input" value={modal.data.name || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, name: e.target.value } }))} /></Field>
              <Field label="Subject"><input className="input" value={modal.data.subject || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, subject: e.target.value } }))} /></Field>
              {modal.data.template_type === 'sms' ? (
                <Field label="Body text"><textarea className="textarea" rows={8} value={modal.data.body_text || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, body_text: e.target.value } }))} /></Field>
              ) : (
                <Field label="Body HTML"><textarea className="textarea" rows={10} value={modal.data.body_html || ''} onChange={(e) => setModal((m) => ({ ...m, data: { ...m.data, body_html: e.target.value } }))} /></Field>
              )}
              <div className="fieldHint" style={{ marginTop: 8 }}>Shortcodes: {shortcodeHelp ? Object.values(shortcodeHelp).flat().slice(0, 12).join(' · ') : 'Load templates to view shortcodes.'}</div>
              <div className="pageHeaderActions"><button className="primaryButton" type="button" onClick={saveTemplateEdit}>Save</button></div>
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
