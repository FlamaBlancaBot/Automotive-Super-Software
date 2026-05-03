import { useEffect, useState } from 'react'
import { apiGet } from '../api/http'
import { setDocumentTitle } from '../utils/title'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

export default function JobSheets({ onOpenJobSheet }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    setDocumentTitle('Job Sheets')
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

  return (
    <div className="jobSheetsPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Job Sheets</h2>
          <p className="pageSubtitle">
            Foundation: printable job sheet view (more fields and signatures will come later).
          </p>
        </div>
        <span className="setupPill" title="Early preview">
          Early preview
        </span>
      </header>

      {error ? <div className="notice bad">{error}</div> : null}

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Recent jobs</h3>
          <div className="fieldHint">
            {status === 'loading' ? 'Loading…' : `${jobs.length} job(s)`}
          </div>
        </div>

        {status === 'loading' ? (
          <div className="emptyState" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : jobs.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>REG</th>
                  <th>Customer</th>
                  <th>Job</th>
                  <th>Booked</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="mono">{j.id}</td>
                    <td className="mono">{j.vehicle_registration}</td>
                    <td>
                      {j.customer_first_name} {j.customer_surname}
                    </td>
                    <td>
                      <div style={{ fontWeight: 900 }}>{j.title}</div>
                      <div className="fieldHint">{j.service_template_name}</div>
                    </td>
                    <td>{formatDateTime(j.booked_start)}</td>
                    <td>
                      <button
                        type="button"
                        className="miniButton primary"
                        onClick={() => onOpenJobSheet && onOpenJobSheet(j.id)}
                      >
                        Open job sheet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            No jobs found.
          </div>
        )}
      </div>
    </div>
  )
}

