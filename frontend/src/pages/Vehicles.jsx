import { useEffect, useState } from 'react'
import { apiGet } from '../api/http'
import { setDocumentTitle } from '../utils/title'

export default function Vehicles({ onOpenIntake }) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [vehicles, setVehicles] = useState([])

  useEffect(() => {
    setDocumentTitle('Vehicles')
  }, [])

  async function load() {
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

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="vehiclesPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Vehicles</h2>
          <p className="pageSubtitle">Search vehicles already known to the database/webhook.</p>
        </div>
        <span className="setupPill" title="Database-backed">
          Live
        </span>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Search</h3>
          <div className="fieldHint">{vehicles.length} vehicle(s)</div>
        </div>

        <div className="pageHeaderActions" style={{ marginTop: 12 }}>
          <input
            className="input"
            style={{ width: 320 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="REG, make, model…"
          />
          <button type="button" className="secondaryButton" onClick={load} disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading…' : 'Search'}
          </button>
        </div>

        {error ? <div className="notice bad">{error}</div> : null}
      </div>

      <div className="cardBox" style={{ marginTop: 12 }}>
        <div className="cardTop">
          <h3 className="cardTitle">Results</h3>
          <div className="fieldHint">Open a vehicle in Onboarding to view linked customers and start a job.</div>
        </div>

        {vehicles.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 12 }}>
            <table className="quoteTable" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>REG</th>
                  <th>Vehicle</th>
                  <th>MOT</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.registration}</td>
                    <td>
                      {v.make || '—'} {v.model || ''} {v.year ? `(${v.year})` : ''}
                    </td>
                    <td>{v.mot_status || '—'} {v.mot_expiry ? `· ${v.mot_expiry}` : ''}</td>
                    <td>
                      <button
                        type="button"
                        className="miniButton primary"
                        onClick={() => onOpenIntake && onOpenIntake(v.registration)}
                      >
                        Open in Intake
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 12 }}>
            No vehicles found.
          </div>
        )}
      </div>
    </div>
  )
}

