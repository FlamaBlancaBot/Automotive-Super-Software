import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import { setDocumentTitle } from '../utils/title'

const RANGES = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
]

function money(value) {
  const n = Number(value || 0)
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(value) {
  const n = Number(value || 0) * 100
  return `${n.toFixed(1)}%`
}

function number(value) {
  return Number(value || 0).toLocaleString('en-GB')
}

export default function Reports() {
  const [range, setRange] = useState('30d')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  useEffect(() => {
    setDocumentTitle('Reports')
  }, [])

  async function load(nextRange = range) {
    setStatus('loading')
    setError('')
    try {
      const out = await apiGet(`/api/reports/summary?range=${encodeURIComponent(nextRange)}`)
      setData(out)
      setStatus('ready')
    } catch (err) {
      setError(err.message || 'Failed to load reports.')
      setStatus('error')
    }
  }

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const overview = data?.overview || {}
  const quoteAcceptanceRate = useMemo(() => {
    const total = Number(overview.quotes_total || 0)
    const accepted = Number(overview.quotes_accepted || 0)
    return total > 0 ? accepted / total : 0
  }, [overview])

  const maxRevenue = useMemo(() => {
    const rows = data?.revenue || []
    return Math.max(1, ...rows.map((r) => Number(r.revenue_total || 0)))
  }, [data])

  return (
    <div className="reportsPage">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">Reports & Analytics</h2>
          <p className="pageSubtitle">Manager-facing business and workshop insights.</p>
        </div>
        <div className="pageHeaderActions">
          <select className="select" value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button type="button" className="secondaryButton" onClick={() => load(range)}>Refresh</button>
        </div>
      </header>

      {error ? <div className="notice bad">{error}</div> : null}
      {status === 'loading' ? <div className="emptyState">Loading reports…</div> : null}

      {status === 'ready' && data ? (
        <>
          <div className="cards" style={{ marginTop: 12 }}>
            <div className="cardBox"><div className="fieldLabel">Revenue</div><div className="kpiValue">{money(overview.revenue_total)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Paid invoices</div><div className="kpiValue">{number(overview.paid_invoices_count)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Payments received</div><div className="kpiValue">{money(overview.payments_received_total)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Jobs completed</div><div className="kpiValue">{number(overview.jobs_completed)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Jobs in progress</div><div className="kpiValue">{number(overview.jobs_in_progress)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Quote acceptance</div><div className="kpiValue">{pct(quoteAcceptanceRate)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Avg invoice value</div><div className="kpiValue">{money(overview.average_invoice_value)}</div></div>
          </div>

          <div className="cards" style={{ marginTop: 12 }}>
            <div className="cardBox"><div className="fieldLabel">Outstanding balance</div><div className="kpiValue">{money(overview.outstanding_balance_total)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Unpaid invoices</div><div className="kpiValue">{number(overview.unpaid_invoices_count)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Partially paid invoices</div><div className="kpiValue">{number(overview.partially_paid_invoices_count)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Payments count</div><div className="kpiValue">{number(overview.payments_count)}</div></div>
          </div>

          <div className="cardBox" style={{ marginTop: 16 }}>
            <div className="cardTop"><h3 className="cardTitle">Revenue Trend</h3></div>
            {data.revenue?.length ? (
              <div className="reportsBars">
                {data.revenue.map((row) => {
                  const value = Number(row.revenue_total || 0)
                  const h = Math.max(8, Math.round((value / maxRevenue) * 120))
                  return (
                    <div key={row.date} className="reportsBarCol" title={`${row.date}: ${money(value)}`}>
                      <div className="reportsBar" style={{ height: `${h}px` }}></div>
                      <div className="reportsBarLabel">{row.date}</div>
                      <div className="reportsBarValue">{money(value)}</div>
                    </div>
                  )
                })}
              </div>
            ) : <div className="emptyState">No revenue data in this range.</div>}
          </div>

          <div className="cardBox" style={{ marginTop: 16 }}>
            <div className="cardTop"><h3 className="cardTitle">Technician Performance</h3></div>
            <div className="quoteTableWrap" style={{ marginTop: 12 }}>
              <table className="quoteTable">
                <thead><tr><th>Technician</th><th>Assigned</th><th>Completed</th><th>Estimated h</th><th>Actual h</th><th>Active jobs</th><th>Activity</th><th>Skills</th></tr></thead>
                <tbody>
                  {(data.technicians || []).map((t) => (
                    <tr key={t.technician_id} className={Number(t.actual_hours) > Number(t.estimated_hours) && Number(t.estimated_hours) > 0 ? 'reportsOverrunRow' : ''}>
                      <td>{t.technician_name}</td><td>{number(t.jobs_assigned)}</td><td>{number(t.jobs_completed)}</td><td>{Number(t.estimated_hours || 0).toFixed(2)}</td><td>{Number(t.actual_hours || 0).toFixed(2)}</td><td>{number(t.active_jobs)}</td><td>{number(t.activity_events_count)}</td><td>{number(t.skills_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cardBox" style={{ marginTop: 16 }}>
            <div className="cardTop"><h3 className="cardTitle">Bay Utilisation</h3></div>
            <div className="quoteTableWrap" style={{ marginTop: 12 }}>
              <table className="quoteTable">
                <thead><tr><th>Bay</th><th>Type</th><th>MOT</th><th>Active now</th><th>Assignments in range</th><th>Released in range</th><th>Current vehicle</th></tr></thead>
                <tbody>
                  {(data.bays || []).map((b) => (
                    <tr key={b.bay_id} style={{ opacity: Number(b.active) ? 1 : 0.6 }}>
                      <td>{b.bay_name}</td><td>{b.bay_type}</td><td>{Number(b.is_mot_bay) ? 'YES' : 'NO'}</td><td>{number(b.active_assignments)}</td><td>{number(b.assignments_in_range)}</td><td>{number(b.completed_or_released_in_range)}</td><td className="mono">{b.current_job_registration || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cardBox" style={{ marginTop: 16 }}>
            <div className="cardTop"><h3 className="cardTitle">Popular Services</h3></div>
            <div className="quoteTableWrap" style={{ marginTop: 12 }}>
              <table className="quoteTable">
                <thead><tr><th>Service</th><th>Jobs</th><th>Completed</th><th>Revenue</th></tr></thead>
                <tbody>
                  {(data.services || []).map((s) => (
                    <tr key={`${s.service_title}`}><td>{s.service_title}</td><td>{number(s.jobs_count)}</td><td>{number(s.completed_count)}</td><td>{money(s.revenue_total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cards" style={{ marginTop: 16 }}>
            <div className="cardBox"><div className="fieldLabel">Total customers</div><div className="kpiValue">{number(data.customers?.total_customers)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Repeat customers</div><div className="kpiValue">{number(data.customers?.repeat_customers)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Repeat rate</div><div className="kpiValue">{pct(data.customers?.repeat_customer_rate)}</div></div>
            <div className="cardBox"><div className="fieldLabel">New customers in range</div><div className="kpiValue">{number(data.customers?.new_customers_in_range)}</div></div>
          </div>

          <div className="cards" style={{ marginTop: 16 }}>
            <div className="cardBox"><div className="fieldLabel">Parts total</div><div className="kpiValue">{number(data.parts?.parts_orders_count)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Parts pending</div><div className="kpiValue">{number(data.parts?.pending_count)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Parts received</div><div className="kpiValue">{number(data.parts?.received_count)}</div></div>
            <div className="cardBox"><div className="fieldLabel">Parts returned</div><div className="kpiValue">{number(data.parts?.returned_count)}</div></div>
          </div>

          <div className="cardBox" style={{ marginTop: 16 }}>
            <div className="cardTop"><h3 className="cardTitle">Profit / Margin</h3></div>
            <div className="emptyState" style={{ marginTop: 12 }}>{data.profit_margin?.note || 'Not enough cost data yet.'}</div>
          </div>
        </>
      ) : null}
    </div>
  )
}
