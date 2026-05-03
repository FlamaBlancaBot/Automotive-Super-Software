import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

export default function Suppliers() {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState([])

  const [createStatus, setCreateStatus] = useState('idle')
  const [createError, setCreateError] = useState('')
  const [draft, setDraft] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    website: '',
    notes: '',
  })

  useEffect(() => {
    setDocumentTitle('Suppliers')
  }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet('/api/suppliers')
      setSuppliers(data.suppliers || [])
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load suppliers.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canCreate = Boolean(String(draft.name || '').trim()) && createStatus !== 'saving'

  async function createSupplier() {
    if (!canCreate) return
    setCreateStatus('saving')
    setCreateError('')
    try {
      await apiPost('/api/suppliers', {
        name: String(draft.name || '').trim(),
        contact_name: String(draft.contact_name || '').trim() || null,
        phone: String(draft.phone || '').trim() || null,
        email: String(draft.email || '').trim() || null,
        website: String(draft.website || '').trim() || null,
        notes: String(draft.notes || '').trim() || null,
      })
      setDraft({ name: '', contact_name: '', phone: '', email: '', website: '', notes: '' })
      setCreateStatus('idle')
      await load()
    } catch (err) {
      setCreateStatus('error')
      setCreateError(err.message || 'Failed to create supplier.')
    }
  }

  return (
    <div className="suppliersPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Suppliers</h2>
          <p className="pageSubtitle">Manage suppliers used for quote supplier options and parts orders.</p>
        </div>
        <span className="setupPill" title="Database-backed">
          Live
        </span>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Create supplier</h3>
          <div className="fieldHint">Keep it simple for MVP.</div>
        </div>

        <div className="fieldGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <div className="fieldLabel">
              Name <span className="req">*</span>
            </div>
            <input className="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="field">
            <div className="fieldLabel">Contact name</div>
            <input className="input" value={draft.contact_name} onChange={(e) => setDraft((d) => ({ ...d, contact_name: e.target.value }))} />
          </div>
          <div className="field">
            <div className="fieldLabel">Phone</div>
            <input className="input" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} />
          </div>
          <div className="field">
            <div className="fieldLabel">Email</div>
            <input className="input" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
          </div>
          <div className="field">
            <div className="fieldLabel">Website</div>
            <input className="input" value={draft.website} onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))} />
          </div>
          <div className="field" style={{ gridColumn: 'span 12' }}>
            <div className="fieldLabel">Notes</div>
            <textarea className="textarea" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
          </div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <button type="button" className="primaryButton" onClick={createSupplier} disabled={!canCreate}>
            {createStatus === 'saving' ? 'Creating…' : 'Create supplier'}
          </button>
        </div>

        {createError ? <div className="notice bad">{createError}</div> : null}
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Suppliers</h3>
          <div className="fieldHint">
            {status === 'loading' ? 'Loading…' : `${suppliers.length} supplier(s)`}
          </div>
        </div>

        {error ? <div className="notice bad">{error}</div> : null}

        {suppliers.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 900 }}>{s.name}</td>
                    <td>{s.contact_name || '—'}</td>
                    <td className="mono">{s.phone || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.website || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            No suppliers yet.
          </div>
        )}
      </div>
    </div>
  )
}

