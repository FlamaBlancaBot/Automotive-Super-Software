import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

const CHANNEL_OPTIONS = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp_manual', label: 'WhatsApp (manual)' },
  { value: 'phone_call', label: 'Phone call' },
  { value: 'internal_note', label: 'Internal note' },
]

const PURPOSE_OPTIONS = [
  'quote_approval',
  'job_status_update',
  'appointment_reminder',
  'ready_to_collect',
  'payment_confirmation',
  'invoice_reminder',
  'customer_details_request',
  'general',
]

const STATUS_OPTIONS = ['draft', 'manual_required', 'queued', 'sent', 'failed', 'cancelled']
const TABS = ['compose', 'history', 'templates']

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

function purposeLabel(value) {
  return String(value || 'general').replaceAll('_', ' ')
}

function shortBody(value) {
  const text = String(value || '').trim()
  if (!text) return '—'
  return text.length > 180 ? `${text.slice(0, 180)}...` : text
}

export default function Communications({ locationPath }) {
  const [messages, setMessages] = useState([])
  const [templates, setTemplates] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState('compose')

  const [filter, setFilter] = useState({ channel: '', purpose: '', status: '' })

  const [draft, setDraft] = useState({
    customer_id: '',
    job_id: '',
    quote_id: '',
    invoice_id: '',
    channel: 'sms',
    purpose: 'general',
    recipient_name: '',
    recipient_phone: '',
    recipient_email: '',
    subject: '',
    body: '',
    template_id: '',
  })

  const [templateDraft, setTemplateDraft] = useState({
    id: null,
    name: '',
    channel: 'sms',
    purpose: 'general',
    subject: '',
    body: '',
    active: true,
  })

  useEffect(() => {
    setDocumentTitle('Communications')
  }, [])

  useEffect(() => {
    const q = String(locationPath || '').split('?')[1] || ''
    const params = new URLSearchParams(q)
    const jobId = params.get('job_id')
    if (jobId) {
      setDraft((prev) => ({ ...prev, job_id: jobId }))
      load({ ...filter, job_id: jobId })
    } else {
      load(filter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationPath])

  async function load(nextFilter = filter) {
    setStatus('loading')
    setError('')
    try {
      const query = new URLSearchParams()
      if (nextFilter.channel) query.set('channel', nextFilter.channel)
      if (nextFilter.purpose) query.set('purpose', nextFilter.purpose)
      if (nextFilter.status) query.set('status', nextFilter.status)
      if (nextFilter.job_id) query.set('job_id', nextFilter.job_id)

      const [mRes, tRes] = await Promise.all([
        apiGet(`/api/communications/messages${query.toString() ? `?${query.toString()}` : ''}`),
        apiGet('/api/communications/templates'),
      ])
      setMessages(mRes.messages || [])
      setTemplates(tRes.templates || [])
      setStatus('ready')
    } catch (err) {
      setError(err.message || 'Failed to load communications.')
      setStatus('error')
    }
  }

  const activeTemplate = useMemo(
    () => templates.find((t) => Number(t.id) === Number(draft.template_id)) || null,
    [templates, draft.template_id],
  )

  const summary = useMemo(() => {
    const out = {
      total: messages.length,
      manual_required: 0,
      sent: 0,
      failed: 0,
      templates: templates.length,
    }
    for (const m of messages) {
      const statusValue = String(m.status || '').toLowerCase()
      if (statusValue === 'manual_required') out.manual_required += 1
      if (statusValue === 'sent') out.sent += 1
      if (statusValue === 'failed') out.failed += 1
    }
    return out
  }, [messages, templates])

  function applyTemplate() {
    if (!activeTemplate) return
    setDraft((prev) => ({
      ...prev,
      channel: activeTemplate.channel || prev.channel,
      purpose: activeTemplate.purpose || prev.purpose,
      subject: activeTemplate.subject || '',
      body: activeTemplate.body || '',
    }))
    setNotice(`Template applied: ${activeTemplate.name}`)
  }

  async function saveMessage() {
    setNotice('')
    setError('')
    try {
      await apiPost('/api/communications/messages', {
        customer_id: draft.customer_id || null,
        job_id: draft.job_id || null,
        quote_id: draft.quote_id || null,
        invoice_id: draft.invoice_id || null,
        channel: draft.channel,
        direction: draft.channel === 'internal_note' ? 'internal' : 'outbound',
        purpose: draft.purpose,
        recipient_name: draft.recipient_name || null,
        recipient_phone: draft.recipient_phone || null,
        recipient_email: draft.recipient_email || null,
        subject: draft.channel === 'email' ? draft.subject : null,
        body: draft.body,
      })
      setNotice('Message record created. Send manually if required.')
      setDraft((prev) => ({ ...prev, subject: '', body: '', template_id: '' }))
      setActiveTab('history')
      await load(filter)
    } catch (err) {
      setError(err.message || 'Failed to save message record.')
    }
  }

  async function markSent(id) {
    await apiPost(`/api/communications/messages/${id}/mark-sent`, {})
    await load(filter)
  }

  async function markFailed(id) {
    const reason = window.prompt('Failure reason', 'Failed manually')
    if (reason == null) return
    await apiPost(`/api/communications/messages/${id}/mark-failed`, { error_message: reason })
    await load(filter)
  }

  async function saveTemplate() {
    setNotice('')
    setError('')
    try {
      if (templateDraft.id) {
        await apiPatch(`/api/communications/templates/${templateDraft.id}`, templateDraft)
        setNotice('Template updated.')
      } else {
        await apiPost('/api/communications/templates', templateDraft)
        setNotice('Template created.')
      }
      setTemplateDraft({ id: null, name: '', channel: 'sms', purpose: 'general', subject: '', body: '', active: true })
      await load(filter)
    } catch (err) {
      setError(err.message || 'Failed to save template.')
    }
  }

  return (
    <div className="reportsPage communicationsPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Customer Communication Center</h2>
          <p className="pageSubtitle">Manage customer updates, reminders, and communication records by job/quote/invoice context.</p>
        </div>
        <div className="pageHeaderActions">
          <button type="button" className="secondaryButton" onClick={() => load(filter)}>Refresh</button>
        </div>
      </header>

      <div className="notice warn">
        SMS/email provider is not connected yet. Messages are recorded here and should be sent manually.
      </div>

      {notice ? <div className="notice good">{notice}</div> : null}
      {error ? <div className="notice bad">{error}</div> : null}
      {status === 'loading' ? <div className="emptyState">Loading communications…</div> : null}

      <div className="cards" style={{ marginTop: 12 }}>
        <div className="cardBox"><div className="fieldLabel">Total messages</div><div className="kpiValue">{summary.total}</div></div>
        <div className="cardBox"><div className="fieldLabel">Manual required</div><div className="kpiValue">{summary.manual_required}</div></div>
        <div className="cardBox"><div className="fieldLabel">Sent</div><div className="kpiValue">{summary.sent}</div></div>
        <div className="cardBox"><div className="fieldLabel">Failed</div><div className="kpiValue">{summary.failed}</div></div>
        <div className="cardBox"><div className="fieldLabel">Templates</div><div className="kpiValue">{summary.templates}</div></div>
      </div>

      <div className="tabs" style={{ marginTop: 16 }}>
        <button type="button" className={`tab ${activeTab === 'compose' ? 'active' : ''}`} onClick={() => setActiveTab('compose')}>Compose</button>
        <button type="button" className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>Message History</button>
        <button type="button" className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>Templates</button>
      </div>

      {activeTab === 'compose' ? (
        <div className="cardBox" style={{ marginTop: 12 }}>
          <div className="cardTop"><h3 className="cardTitle">Compose Message Record</h3></div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Channel</div><select className="select" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })}>{CHANNEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Purpose</div><select className="select" value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}>{PURPOSE_OPTIONS.map((opt) => <option key={opt} value={opt}>{purposeLabel(opt)}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 4' }}>
              <div className="fieldLabel">Template</div>
              <div className="quoteRegRow">
                <select className="select" value={draft.template_id} onChange={(e) => setDraft({ ...draft, template_id: e.target.value })}><option value="">None</option>{templates.filter((t) => Number(t.active)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <button type="button" className="secondaryButton" onClick={applyTemplate}>Apply</button>
              </div>
            </div>

            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Customer ID</div><input className="input" value={draft.customer_id} onChange={(e) => setDraft({ ...draft, customer_id: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Job ID</div><input className="input" value={draft.job_id} onChange={(e) => setDraft({ ...draft, job_id: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Quote ID</div><input className="input" value={draft.quote_id} onChange={(e) => setDraft({ ...draft, quote_id: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Invoice ID</div><input className="input" value={draft.invoice_id} onChange={(e) => setDraft({ ...draft, invoice_id: e.target.value })} /></div>

            <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Recipient name</div><input className="input" value={draft.recipient_name} onChange={(e) => setDraft({ ...draft, recipient_name: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Recipient phone</div><input className="input" value={draft.recipient_phone} onChange={(e) => setDraft({ ...draft, recipient_phone: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Recipient email</div><input className="input" value={draft.recipient_email} onChange={(e) => setDraft({ ...draft, recipient_email: e.target.value })} /></div>

            {draft.channel === 'email' ? <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Subject</div><input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></div> : null}
            <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Body</div><textarea className="textarea" rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></div>

            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="pageHeaderActions" style={{ justifyContent: 'flex-start' }}>
                <button type="button" className="primaryButton" onClick={saveMessage}>Create Message Record</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <div className="cardBox" style={{ marginTop: 12 }}>
          <div className="cardTop"><h3 className="cardTitle">Message History</h3></div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Filter channel</div><select className="select" value={filter.channel} onChange={(e) => setFilter({ ...filter, channel: e.target.value })}><option value="">All</option>{CHANNEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Filter purpose</div><select className="select" value={filter.purpose} onChange={(e) => setFilter({ ...filter, purpose: e.target.value })}><option value="">All</option>{PURPOSE_OPTIONS.map((opt) => <option key={opt} value={opt}>{purposeLabel(opt)}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Filter status</div><select className="select" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">All</option>{STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'end' }}><button type="button" className="secondaryButton" onClick={() => load(filter)}>Apply Filters</button></div>
          </div>

          <div className="communicationsHistory" style={{ marginTop: 14 }}>
            {messages.length ? messages.map((m) => (
              <article className="communicationsHistoryCard" key={m.id}>
                <div className="communicationsHistoryTop">
                  <div className="pageHeaderActions" style={{ justifyContent: 'flex-start', gap: 6 }}>
                    <span className="statusChip chipGrey">{m.channel}</span>
                    <span className="statusChip chipGrey">{purposeLabel(m.purpose)}</span>
                    <span className="statusChip chipGrey">{m.status}</span>
                  </div>
                  <div className="fieldHint">#{m.id}</div>
                </div>
                <div className="fieldHint" style={{ marginTop: 6 }}>
                  Recipient: {m.recipient_name || m.recipient_phone || m.recipient_email || 'No recipient set'}
                </div>
                <div className="fieldHint">Links: Job {m.job_id || '—'} · Quote {m.quote_number || m.quote_id || '—'} · Invoice {m.invoice_number || m.invoice_id || '—'}</div>
                <div className="communicationsBodyPreview">{shortBody(m.body)}</div>
                <div className="activityTimelineMeta">Created: {formatDate(m.created_at)} · Sent: {formatDate(m.sent_at)}</div>
                <div className="pageHeaderActions" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
                  <button type="button" className="miniButton" onClick={() => markSent(m.id)}>Mark sent</button>
                  <button type="button" className="miniButton" onClick={() => markFailed(m.id)}>Mark failed</button>
                </div>
              </article>
            )) : <div className="emptyState">No communication messages yet.</div>}
          </div>
        </div>
      ) : null}

      {activeTab === 'templates' ? (
        <div className="cardBox" style={{ marginTop: 12 }}>
          <div className="cardTop"><h3 className="cardTitle">Template Library</h3></div>
          <div className="fieldGrid" style={{ marginTop: 12 }}>
            <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Template name</div><input className="input" value={templateDraft.name} onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Channel</div><select className="select" value={templateDraft.channel} onChange={(e) => setTemplateDraft({ ...templateDraft, channel: e.target.value })}>{CHANNEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Purpose</div><select className="select" value={templateDraft.purpose} onChange={(e) => setTemplateDraft({ ...templateDraft, purpose: e.target.value })}>{PURPOSE_OPTIONS.map((opt) => <option key={opt} value={opt}>{purposeLabel(opt)}</option>)}</select></div>
            <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Active</div><select className="select" value={templateDraft.active ? '1' : '0'} onChange={(e) => setTemplateDraft({ ...templateDraft, active: e.target.value === '1' })}><option value="1">Active</option><option value="0">Inactive</option></select></div>
            {templateDraft.channel === 'email' ? <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Subject</div><input className="input" value={templateDraft.subject} onChange={(e) => setTemplateDraft({ ...templateDraft, subject: e.target.value })} /></div> : null}
            <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Body</div><textarea className="textarea" rows={4} value={templateDraft.body} onChange={(e) => setTemplateDraft({ ...templateDraft, body: e.target.value })} /></div>
            <div className="field" style={{ gridColumn: 'span 12' }}>
              <div className="pageHeaderActions" style={{ justifyContent: 'flex-start', gap: 8 }}>
                <button type="button" className="primaryButton" onClick={saveTemplate}>{templateDraft.id ? 'Update template' : 'Add template'}</button>
                {templateDraft.id ? <button type="button" className="secondaryButton" onClick={() => setTemplateDraft({ id: null, name: '', channel: 'sms', purpose: 'general', subject: '', body: '', active: true })}>Cancel</button> : null}
              </div>
            </div>
          </div>

          <div className="communicationsTemplatesList" style={{ marginTop: 14 }}>
            {templates.length ? templates.map((t) => (
              <article className="communicationsTemplateCard" key={t.id} style={{ opacity: Number(t.active) ? 1 : 0.64 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div className="fieldHint">{t.channel} · {purposeLabel(t.purpose)} · {Number(t.active) ? 'active' : 'inactive'}</div>
                </div>
                <button type="button" className="miniButton" onClick={() => setTemplateDraft({ id: t.id, name: t.name || '', channel: t.channel || 'sms', purpose: t.purpose || 'general', subject: t.subject || '', body: t.body || '', active: Number(t.active) === 1 })}>Edit</button>
              </article>
            )) : <div className="emptyState">No templates yet.</div>}
          </div>
        </div>
      ) : null}
    </div>
  )
}
