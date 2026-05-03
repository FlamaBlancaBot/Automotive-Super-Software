import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import { setDocumentTitle } from '../utils/title'

const COLUMNS = [
  { key: 'new', label: 'New' },
  { key: 'booked_in', label: 'Booked in' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'awaiting_parts', label: 'Awaiting parts' },
  { key: 'awaiting_authorisation', label: 'Awaiting auth' },
  { key: 'completed', label: 'Completed' },
]

function normaliseStatus(status) {
  return String(status || '').trim().toLowerCase()
}

function openJobFallback(id) {
  window.history.pushState({}, '', `/jobs/${id}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function Kanban({ onOpenJob, embedded = false }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    setDocumentTitle('Kanban')
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setStatus('loading')
      setError('')
      try {
        const data = await apiGet('/api/jobs')
        if (cancelled) return
        setJobs(data.jobs || [])
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err.message || 'Failed to load jobs.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(() => {
    const map = new Map(COLUMNS.map((c) => [c.key, []]))
    for (const j of jobs || []) {
      const s = normaliseStatus(j.status)
      const col = map.has(s) ? s : 'new'
      map.get(col).push(j)
    }
    for (const c of COLUMNS) {
      map.get(c.key).sort((a, b) => Number(b.id) - Number(a.id))
    }
    return map
  }, [jobs])

  return (
    <div className="kanbanPage">
      {!embedded ? (
        <header className="pageHeader">
          <div>
            <h2 className="pageTitle">Kanban</h2>
            <p className="pageSubtitle">Foundation board: quick view of jobs by status (drag/drop comes later).</p>
          </div>
          <span className="setupPill" title="Early preview">
            Early preview
          </span>
        </header>
      ) : null}

      {error ? <div className="notice bad">{error}</div> : null}

      {status === 'loading' ? (
        <div className="emptyState">Loading…</div>
      ) : (
        <div className="kanbanGrid">
          {COLUMNS.map((c) => {
            const list = grouped.get(c.key) || []
            return (
              <div key={c.key} className="kanbanCol">
                <div className="kanbanColTop">
                  <div className="kanbanColTitle">{c.label}</div>
                  <div className="fieldHint">{list.length}</div>
                </div>
                <div className="kanbanCards">
                  {list.slice(0, 25).map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      className="kanbanCard"
                      onClick={() => (onOpenJob ? onOpenJob(j.id) : openJobFallback(j.id))}
                    >
                      <div className="kanbanCardTop">
                        <span className="mono">{j.vehicle_registration}</span>
                        <span className="statusChip chipGrey">{j.status}</span>
                      </div>
                      <div style={{ fontWeight: 900, marginTop: 6 }}>{j.title}</div>
                      <div className="fieldHint" style={{ marginTop: 4 }}>
                        {j.customer_first_name} {j.customer_surname}
                      </div>
                    </button>
                  ))}
                  {!list.length ? <div className="fieldHint">No jobs.</div> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
