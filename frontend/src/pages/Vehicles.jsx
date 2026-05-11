import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

function normReg(v) {
  return String(v || '').toUpperCase().replace(/\s+/g, '').trim()
}

function fmtDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('en-GB')
}

function money(v) {
  return `£${Number(v || 0).toFixed(2)}`
}

export default function Vehicles({ onOpenIntake }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [selectedReg, setSelectedReg] = useState('')
  const [overview, setOverview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [historyDraft, setHistoryDraft] = useState({ title: '', event_type: 'manual_note', description: '', mileage: '', event_date: '' })
  const [recommendationDraft, setRecommendationDraft] = useState({ recommendation_type: 'general', title: '', description: '', due_mileage: '', due_date: '', priority: 'medium', status: 'open' })
  const [documentDraft, setDocumentDraft] = useState({ title: '', document_type: 'document', file_url: '', notes: '', document_date: '' })

  useEffect(() => {
    setDocumentTitle('Vehicles')
  }, [])

  async function loadList() {
    setStatus('loading')
    setError('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      const data = await apiGet(`/api/vehicles?${params.toString()}`)
      setVehicles(data.vehicles || [])
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Failed to load vehicles.')
    }
  }

  async function loadOverview(reg) {
    const regNorm = normReg(reg)
    if (!regNorm) return
    setBusy(true)
    try {
      const data = await apiGet(`/api/vehicles/${encodeURIComponent(regNorm)}/overview`)
      setOverview(data)
      setSelectedReg(regNorm)
    } catch (err) {
      setError(err.message || 'Failed to load vehicle overview.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openRecommendations = useMemo(
    () => (overview?.maintenance_recommendations || []).filter((r) => ['open', 'planned'].includes(String(r.status || '').toLowerCase())),
    [overview],
  )

  async function addHistoryEvent() {
    if (!selectedReg || !historyDraft.title.trim()) return
    await apiPost(`/api/vehicles/${encodeURIComponent(selectedReg)}/history`, {
      ...historyDraft,
      mileage: historyDraft.mileage === '' ? null : Number(historyDraft.mileage),
      event_date: historyDraft.event_date || null,
    })
    setHistoryDraft({ title: '', event_type: 'manual_note', description: '', mileage: '', event_date: '' })
    await loadOverview(selectedReg)
  }

  async function addRecommendation() {
    if (!selectedReg || !recommendationDraft.title.trim()) return
    await apiPost(`/api/vehicles/${encodeURIComponent(selectedReg)}/maintenance`, {
      ...recommendationDraft,
      due_mileage: recommendationDraft.due_mileage === '' ? null : Number(recommendationDraft.due_mileage),
      due_date: recommendationDraft.due_date || null,
    })
    setRecommendationDraft({ recommendation_type: 'general', title: '', description: '', due_mileage: '', due_date: '', priority: 'medium', status: 'open' })
    await loadOverview(selectedReg)
  }

  async function patchRecommendation(id, patch) {
    await apiPatch(`/api/vehicles/${encodeURIComponent(selectedReg)}/maintenance/${id}`, patch)
    await loadOverview(selectedReg)
  }

  async function addDocumentRecord() {
    if (!selectedReg || !documentDraft.title.trim()) return
    await apiPost(`/api/vehicles/${encodeURIComponent(selectedReg)}/documents`, {
      ...documentDraft,
      file_url: documentDraft.file_url || null,
      notes: documentDraft.notes || null,
      document_date: documentDraft.document_date || null,
    })
    setDocumentDraft({ title: '', document_type: 'document', file_url: '', notes: '', document_date: '' })
    await loadOverview(selectedReg)
  }

  return (
    <div className="vehiclesPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Vehicle Service History</h2>
          <p className="pageSubtitle">Registration-centred timeline for jobs, quotes, invoices, payments, maintenance and documents.</p>
        </div>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Find Vehicle</h3>
          <div className="fieldHint">{vehicles.length} result(s)</div>
        </div>
        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <input className="input" style={{ width: 280 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Enter REG, make, model…" />
          <button type="button" className="secondaryButton" onClick={loadList} disabled={status === 'loading'}>{status === 'loading' ? 'Loading…' : 'Search'}</button>
          <input className="input mono" style={{ width: 180 }} value={selectedReg} onChange={(e) => setSelectedReg(normReg(e.target.value))} placeholder="REG lookup" />
          <button type="button" className="primaryButton" onClick={() => loadOverview(selectedReg)} disabled={!selectedReg || busy}>{busy ? 'Opening…' : 'Open REG'}</button>
        </div>
        {error ? <div className="notice bad" style={{ marginTop: 10 }}>{error}</div> : null}
        {vehicles.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable">
              <thead><tr><th>REG</th><th>Vehicle</th><th>MOT</th><th></th></tr></thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.registration}</td>
                    <td>{v.make || '—'} {v.model || ''} {v.year ? `(${v.year})` : ''}</td>
                    <td>{v.mot_status || '—'} {v.mot_expiry ? `· ${v.mot_expiry}` : ''}</td>
                    <td><button type="button" className="miniButton" onClick={() => loadOverview(v.registration)}>Open history</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {overview ? (
        <>
          <div className="cards" style={{ marginTop: 12 }}>
            <div className="cardBox"><div className="fieldLabel">REG</div><div className="kpiValue mono">{overview.registration}</div></div>
            <div className="cardBox"><div className="fieldLabel">Jobs</div><div className="kpiValue">{Number(overview.jobs?.length || 0)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Quotes</div><div className="kpiValue">{Number(overview.quotes?.length || 0)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Invoices</div><div className="kpiValue">{Number(overview.invoices?.length || 0)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Payments</div><div className="kpiValue">{money(overview.payment_summary?.payments_total)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Active recommendations</div><div className="kpiValue">{openRecommendations.length}</div></div>
          </div>

          <div className="cardBox" style={{ marginTop: 12 }}>
            <div className="cardTop"><h3 className="cardTitle">Vehicle Overview</h3></div>
            <div className="fieldGrid" style={{ marginTop: 10 }}>
              <div className="field"><div className="fieldLabel">Make</div><div>{overview.vehicle?.make || '—'}</div></div>
              <div className="field"><div className="fieldLabel">Model</div><div>{overview.vehicle?.model || '—'}</div></div>
              <div className="field"><div className="fieldLabel">Year</div><div>{overview.vehicle?.year || '—'}</div></div>
              <div className="field"><div className="fieldLabel">MOT</div><div>{overview.vehicle?.mot_status || '—'} {overview.vehicle?.mot_expiry ? `· ${overview.vehicle.mot_expiry}` : ''}</div></div>
              <div className="field"><div className="fieldLabel">Fuel</div><div>{overview.vehicle?.fuel_type || '—'}</div></div>
              <div className="field"><div className="fieldLabel">Colour</div><div>{overview.vehicle?.colour || '—'}</div></div>
            </div>
            <div className="pageHeaderActions" style={{ marginTop: 10 }}>
              <button type="button" className="secondaryButton" onClick={() => onOpenIntake && onOpenIntake(overview.registration)}>Open in Intake</button>
            </div>
          </div>

          <div className="cardBox" style={{ marginTop: 12 }}>
            <div className="cardTop"><h3 className="cardTitle">Service Timeline</h3></div>
            <div className="activityTimelineList" style={{ marginTop: 10 }}>
              {(overview.service_events || []).length ? overview.service_events.slice(0, 80).map((e) => (
                <div className="activityTimelineItem" key={`svc-${e.id}`}>
                  <div className="activityTimelineMarker"></div>
                  <div className="activityTimelineContent">
                    <div className="activityTimelineText">{e.title} ({e.event_type})</div>
                    <div className="fieldHint">{e.description || '—'}</div>
                    <div className="activityTimelineMeta">{fmtDateTime(e.event_date || e.created_at)} · Mileage: {e.mileage || '—'} · Source: {e.source || 'manual'}</div>
                  </div>
                </div>
              )) : <div className="emptyState">No service events yet.</div>}
            </div>
            <div className="fieldGrid" style={{ marginTop: 10 }}>
              <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Title</div><input className="input" value={historyDraft.title} onChange={(e) => setHistoryDraft((d) => ({ ...d, title: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Type</div><input className="input" value={historyDraft.event_type} onChange={(e) => setHistoryDraft((d) => ({ ...d, event_type: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Mileage</div><input className="input" value={historyDraft.mileage} onChange={(e) => setHistoryDraft((d) => ({ ...d, mileage: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Event date</div><input type="datetime-local" className="input" value={historyDraft.event_date} onChange={(e) => setHistoryDraft((d) => ({ ...d, event_date: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Description</div><textarea className="textarea" rows={3} value={historyDraft.description} onChange={(e) => setHistoryDraft((d) => ({ ...d, description: e.target.value }))} /></div>
            </div>
            <div className="pageHeaderActions" style={{ marginTop: 8 }}>
              <button type="button" className="primaryButton" onClick={addHistoryEvent}>Add History Entry</button>
            </div>
          </div>

          <div className="cardBox" style={{ marginTop: 12 }}>
            <div className="cardTop"><h3 className="cardTitle">Maintenance Recommendations</h3></div>
            {(overview.maintenance_recommendations || []).length ? (
              <div className="quoteTableWrap" style={{ marginTop: 10 }}>
                <table className="quoteTable">
                  <thead><tr><th>Title</th><th>Type</th><th>Due</th><th>Priority</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {(overview.maintenance_recommendations || []).map((r) => (
                      <tr key={r.id}>
                        <td>{r.title}</td>
                        <td>{r.recommendation_type}</td>
                        <td>{r.due_mileage ? `${r.due_mileage} mi` : '—'} {r.due_date ? `· ${String(r.due_date).slice(0, 10)}` : ''}</td>
                        <td>{r.priority}</td>
                        <td>{r.status}</td>
                        <td>
                          <button type="button" className="miniButton" onClick={() => patchRecommendation(r.id, { status: 'planned' })}>Planned</button>{' '}
                          <button type="button" className="miniButton" onClick={() => patchRecommendation(r.id, { status: 'completed' })}>Completed</button>{' '}
                          <button type="button" className="miniButton" onClick={() => patchRecommendation(r.id, { status: 'dismissed' })}>Dismiss</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="emptyState" style={{ marginTop: 10 }}>No recommendations yet.</div>}
            <div className="fieldGrid" style={{ marginTop: 10 }}>
              <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Type</div><input className="input" value={recommendationDraft.recommendation_type} onChange={(e) => setRecommendationDraft((d) => ({ ...d, recommendation_type: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 5' }}><div className="fieldLabel">Title</div><input className="input" value={recommendationDraft.title} onChange={(e) => setRecommendationDraft((d) => ({ ...d, title: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Priority</div><select className="select" value={recommendationDraft.priority} onChange={(e) => setRecommendationDraft((d) => ({ ...d, priority: e.target.value }))}><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Status</div><select className="select" value={recommendationDraft.status} onChange={(e) => setRecommendationDraft((d) => ({ ...d, status: e.target.value }))}><option value="open">open</option><option value="planned">planned</option><option value="completed">completed</option><option value="dismissed">dismissed</option></select></div>
              <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Due mileage</div><input className="input" value={recommendationDraft.due_mileage} onChange={(e) => setRecommendationDraft((d) => ({ ...d, due_mileage: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Due date</div><input type="date" className="input" value={recommendationDraft.due_date} onChange={(e) => setRecommendationDraft((d) => ({ ...d, due_date: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Description</div><input className="input" value={recommendationDraft.description} onChange={(e) => setRecommendationDraft((d) => ({ ...d, description: e.target.value }))} /></div>
            </div>
            <div className="pageHeaderActions" style={{ marginTop: 8 }}>
              <button type="button" className="primaryButton" onClick={addRecommendation}>Add Recommendation</button>
            </div>
          </div>

          <div className="cardBox" style={{ marginTop: 12 }}>
            <div className="cardTop"><h3 className="cardTitle">Document Records (Metadata)</h3></div>
            {(overview.document_records || []).length ? (
              <div className="quoteTableWrap" style={{ marginTop: 10 }}>
                <table className="quoteTable">
                  <thead><tr><th>Title</th><th>Type</th><th>Date</th><th>URL</th><th>Notes</th></tr></thead>
                  <tbody>
                    {(overview.document_records || []).map((d) => (
                      <tr key={d.id}>
                        <td>{d.title}</td>
                        <td>{d.document_type}</td>
                        <td>{fmtDateTime(d.document_date || d.created_at)}</td>
                        <td>{d.file_url ? <a href={d.file_url} target="_blank" rel="noreferrer">{d.file_url}</a> : '—'}</td>
                        <td>{d.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="emptyState" style={{ marginTop: 10 }}>No document records yet.</div>}
            <div className="fieldGrid" style={{ marginTop: 10 }}>
              <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Title</div><input className="input" value={documentDraft.title} onChange={(e) => setDocumentDraft((d) => ({ ...d, title: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 2' }}><div className="fieldLabel">Type</div><input className="input" value={documentDraft.document_type} onChange={(e) => setDocumentDraft((d) => ({ ...d, document_type: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">Date</div><input type="date" className="input" value={documentDraft.document_date} onChange={(e) => setDocumentDraft((d) => ({ ...d, document_date: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 3' }}><div className="fieldLabel">File URL (optional)</div><input className="input" value={documentDraft.file_url} onChange={(e) => setDocumentDraft((d) => ({ ...d, file_url: e.target.value }))} /></div>
              <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Notes</div><textarea className="textarea" rows={3} value={documentDraft.notes} onChange={(e) => setDocumentDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
            </div>
            <div className="pageHeaderActions" style={{ marginTop: 8 }}>
              <button type="button" className="primaryButton" onClick={addDocumentRecord}>Add Document Record</button>
            </div>
            <div className="fieldHint" style={{ marginTop: 8 }}>This phase stores document metadata only. File upload/storage integration is future work.</div>
          </div>

          <div className="cards" style={{ marginTop: 12 }}>
            <div className="cardBox">
              <div className="fieldLabel">Linked Jobs</div>
              <div className="kpiValue">{Number(overview.jobs?.length || 0)}</div>
            </div>
            <div className="cardBox">
              <div className="fieldLabel">Linked Quotes</div>
              <div className="kpiValue">{Number(overview.quotes?.length || 0)}</div>
            </div>
            <div className="cardBox">
              <div className="fieldLabel">Linked Invoices</div>
              <div className="kpiValue">{Number(overview.invoices?.length || 0)}</div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
