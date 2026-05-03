import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { partsOrderTone } from '../utils/statusChips'

function parseQuery(locationPath) {
  const q = String(locationPath || '').split('?')[1] || ''
  const params = new URLSearchParams(q)
  return { q: String(params.get('q') || '').trim() }
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

function money(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? `£${n.toFixed(2)}` : '£0.00'
}

export default function Search({ locationPath, onOpenJob, onOpenQuote, onOpenPartsOrders, onOpenVehicle }) {
  const query = useMemo(() => parseQuery(locationPath), [locationPath])
  const [q, setQ] = useState(() => query.q)

  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [results, setResults] = useState(null)

  useEffect(() => {
    setDocumentTitle('Search')
  }, [])

  useEffect(() => {
    setQ(query.q)
  }, [query.q])

  async function runSearch(nextQ) {
    const term = String(nextQ || '').trim()
    if (!term) return
    setStatus('loading')
    setError('')
    setResults(null)
    try {
      const data = await apiGet(`/api/search?q=${encodeURIComponent(term)}`)
      setResults(data.results || null)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Search failed.')
    }
  }

  useEffect(() => {
    if (query.q) runSearch(query.q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.q])

  return (
    <div className="searchPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Search</h2>
          <p className="pageSubtitle">Search jobs, quotes, vehicles, customers, and parts orders.</p>
        </div>
        <span className="setupPill" title="Database-backed">
          Live
        </span>
      </header>

      <div className="cardBox">
        <div className="cardTop">
          <h3 className="cardTitle">Query</h3>
          <div className="fieldHint">Tip: try REG, surname, phone, quote number, or part name.</div>
        </div>
        <form
          className="pageHeaderActions"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault()
            runSearch(q)
          }}
        >
          <input
            className="input"
            style={{ width: 320 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. AB12 CDE, Smith, Q-2026-0001"
          />
          <button type="submit" className="secondaryButton" disabled={!q.trim() || status === 'loading'}>
            {status === 'loading' ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error ? <div className="notice bad">{error}</div> : null}
      </div>

      {!results && status === 'ready' ? (
        <div className="emptyState" style={{ marginTop: 12 }}>
          No results.
        </div>
      ) : null}

      {results ? (
        <>
          <Section title={`Jobs (${results.jobs?.length || 0})`}>
            {results.jobs?.length ? (
              <div className="quoteTableWrap" style={{ marginTop: 12 }}>
                <table className="quoteTable" style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Status</th>
                      <th>REG</th>
                      <th>Customer</th>
                      <th>Job</th>
                      <th>Booked</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="mono">{j.id}</td>
                        <td><span className="statusChip chipGrey">{j.status}</span></td>
                        <td className="mono">{j.vehicle_registration}</td>
                        <td>{j.customer_first_name} {j.customer_surname}</td>
                        <td>{j.title}</td>
                        <td>{formatDateTime(j.booked_start)}</td>
                        <td>
                          <button type="button" className="miniButton primary" onClick={() => onOpenJob && onOpenJob(j.id)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyState" style={{ marginTop: 12 }}>No job matches.</div>
            )}
          </Section>

          <Section title={`Quotes (${results.quotes?.length || 0})`}>
            {results.quotes?.length ? (
              <div className="quoteTableWrap" style={{ marginTop: 12 }}>
                <table className="quoteTable" style={{ minWidth: 920 }}>
                  <thead>
                    <tr>
                      <th>Quote</th>
                      <th>Status</th>
                      <th>REG</th>
                      <th>Customer</th>
                      <th>Title</th>
                      <th>Total</th>
                      <th>Updated</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.quotes.map((qrow) => (
                      <tr key={qrow.id}>
                        <td className="mono">{qrow.quote_number}</td>
                        <td><span className="statusChip chipGrey">{qrow.status}</span></td>
                        <td className="mono">{qrow.vehicle_registration}</td>
                        <td>{qrow.customer_first_name} {qrow.customer_surname}</td>
                        <td>{qrow.title}</td>
                        <td className="mono">{money(qrow.total_sell)}</td>
                        <td>{formatDateTime(qrow.updated_at)}</td>
                        <td>
                          <button type="button" className="miniButton primary" onClick={() => onOpenQuote && onOpenQuote(qrow.id)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyState" style={{ marginTop: 12 }}>No quote matches.</div>
            )}
          </Section>

          <Section title={`Parts orders (${results.parts_orders?.length || 0})`}>
            {results.parts_orders?.length ? (
              <div className="quoteTableWrap" style={{ marginTop: 12 }}>
                <table className="quoteTable" style={{ minWidth: 920 }}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>REG</th>
                      <th>Part</th>
                      <th>Supplier</th>
                      <th>Qty</th>
                      <th>ETA</th>
                      <th>Quote</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.parts_orders.map((po) => (
                      <tr key={po.id}>
                        <td>
                          <span className={`statusChip ${partsOrderTone(po.status)}`}>{po.status}</span>
                        </td>
                        <td className="mono">{po.vehicle_registration || '—'}</td>
                        <td>{po.part_name || '—'}</td>
                        <td>{po.supplier_name || '—'}</td>
                        <td className="mono">{po.quantity}</td>
                        <td>{po.eta_text || formatDateTime(po.expected_at || po.eta_datetime)}</td>
                        <td className="mono">{po.quote_number || '—'}</td>
                        <td>
                          <button type="button" className="miniButton" onClick={() => onOpenPartsOrders && onOpenPartsOrders(po.id)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyState" style={{ marginTop: 12 }}>No parts order matches.</div>
            )}
          </Section>

          <Section title={`Vehicles (${results.vehicles?.length || 0})`}>
            {results.vehicles?.length ? (
              <div className="quoteTableWrap" style={{ marginTop: 12 }}>
                <table className="quoteTable" style={{ minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th>REG</th>
                      <th>Vehicle</th>
                      <th>MOT</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.vehicles.map((v) => (
                      <tr key={v.id}>
                        <td className="mono">{v.registration}</td>
                        <td>{v.make || '—'} {v.model || ''} ({v.year || '—'})</td>
                        <td>{v.mot_status || '—'} {v.mot_expiry ? `· ${v.mot_expiry}` : ''}</td>
                        <td>
                          <button type="button" className="miniButton" onClick={() => onOpenVehicle && onOpenVehicle(v.registration)}>
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyState" style={{ marginTop: 12 }}>No vehicle matches.</div>
            )}
          </Section>

          <Section title={`Customers (${results.customers?.length || 0})`}>
            {results.customers?.length ? (
              <div className="quoteTableWrap" style={{ marginTop: 12 }}>
                <table className="quoteTable" style={{ minWidth: 620 }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.customers.map((c) => (
                      <tr key={c.id}>
                        <td>{c.first_name} {c.surname}</td>
                        <td className="mono">{c.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="emptyState" style={{ marginTop: 12 }}>No customer matches.</div>
            )}
          </Section>
        </>
      ) : null}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="cardBox" style={{ marginTop: 12 }}>
      <div className="cardTop">
        <h3 className="cardTitle">{title}</h3>
      </div>
      {children}
    </div>
  )
}

