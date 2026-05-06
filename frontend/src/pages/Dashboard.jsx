import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import Calendar from './Calendar'
import Kanban from './Kanban'

/* ── KPI icon SVGs ── */
const ICO = { width: 20, height: 20, display: 'block', strokeLinecap: 'round', strokeLinejoin: 'round' }
function IcoWrench()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> }
function IcoFile()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> }
function IcoPhone()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.46 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.69a16 16 0 0 0 6.29 6.29l1.75-1.75a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> }
function IcoPackage()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IcoClock()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg> }
function IcoTruck()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> }
function IcoRotate()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><polyline points="1,4 1,10 7,10"/><path d="M3.51 15a9 9 0 1 0 .49-3.34"/></svg> }
function IcoCheck()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg> }

const KPI_ICONS = {
  jobs:     { icon: <IcoWrench />,   colour: 'blue' },
  quote:    { icon: <IcoFile />,     colour: 'orange' },
  chase:    { icon: <IcoPhone />,    colour: 'purple' },
  parts:    { icon: <IcoPackage />,  colour: 'cyan' },
  waiting:  { icon: <IcoClock />,    colour: 'orange' },
  expected: { icon: <IcoTruck />,    colour: 'green' },
  returns:  { icon: <IcoRotate />,   colour: 'red' },
  mot:      { icon: <IcoCheck />,    colour: 'green' },
}

const SERVICE_BAYS = [
  { num: 1, status: 'inUse',    label: 'In Use' },
  { num: 2, status: 'available',label: 'Available' },
  { num: 3, status: 'inUse',    label: 'In Use' },
  { num: 4, status: 'available',label: 'Available' },
  { num: 5, status: 'cleaning', label: 'Cleaning' },
  { num: 6, status: 'available',label: 'Available' },
]

function customerInitials(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return String(name).slice(0, 2).toUpperCase()
}

export default function Dashboard({ onStartNewIntake, onViewJobsNeedingQuote }) {
  const [summary, setSummary] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await apiGet('/api/dashboard/summary')
        if (cancelled) return
        setSummary(data.summary || null)
        setError('')
      } catch (err) {
        if (cancelled) return
        setError(err.message || 'Failed to load dashboard summary.')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadJobs() {
      try {
        const data = await apiGet('/api/jobs?limit=5&offset=0')
        if (cancelled) return
        const jobs = Array.isArray(data?.jobs) ? data.jobs : []
        setRecentJobs(jobs.slice(0, 5))
      } catch {
        /* recent jobs are a best-effort enhancement */
      }
    }
    loadJobs()
    return () => { cancelled = true }
  }, [])

  const tabs = useMemo(() => [
    { key: 'overview', label: 'Overview' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'kanban',   label: 'Kanban' },
  ], [])

  const alerts = useMemo(() => {
    if (!summary) return []
    const out = []
    if ((summary.jobs_needing_quote || 0) > 0)
      out.push({ type: 'alertWarn', text: `${summary.jobs_needing_quote} job${summary.jobs_needing_quote !== 1 ? 's' : ''} need${summary.jobs_needing_quote === 1 ? 's' : ''} a quote` })
    if ((summary.parts_to_order || 0) > 0)
      out.push({ type: 'alertInfo', text: `${summary.parts_to_order} part line${summary.parts_to_order !== 1 ? 's' : ''} awaiting order` })
    if ((summary.returns_pending || 0) > 0)
      out.push({ type: 'alertWarn', text: `${summary.returns_pending} return${summary.returns_pending !== 1 ? 's' : ''} pending credit` })
    if ((summary.mot_jobs_in_progress || 0) > 0)
      out.push({ type: 'alertInfo', text: `${summary.mot_jobs_in_progress} MOT job${summary.mot_jobs_in_progress !== 1 ? 's' : ''} in progress` })
    if (out.length === 0)
      out.push({ type: 'alertInfo', text: 'No active alerts — all clear' })
    return out
  }, [summary])

  const capacityPct = useMemo(() => {
    const booked = summary?.jobs_booked_today || 0
    return Math.min(100, Math.round((booked / 6) * 100))
  }, [summary])

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="dashboard">
      <div className="dashHeader">
        <div>
          <h2 className="dashHeaderTitle">Dashboard</h2>
          <p className="dashHeaderDate">{today}</p>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Dashboard tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div>
          {/* KPI cards */}
          <section className="cards">
            <KpiCard
              {...KPI_ICONS.jobs}
              title="Jobs Today"
              value={summary ? String(summary.jobs_booked_today || 0) : '—'}
              hint="Booked or requested today"
            />
            <KpiCard
              {...KPI_ICONS.quote}
              title="Jobs Needing Quote"
              value={summary ? String(summary.jobs_needing_quote || 0) : '—'}
              hint="Open jobs with no quote yet"
              onClick={onViewJobsNeedingQuote}
            />
            <KpiCard
              {...KPI_ICONS.chase}
              title="Quotes to Chase"
              value={summary ? String((summary.quotes_by_status?.sent || 0) + (summary.quotes_by_status?.ready || 0)) : '—'}
              hint="Ready / sent — follow up"
            />
            <KpiCard
              {...KPI_ICONS.parts}
              title="Parts to Order"
              value={summary ? String(summary.parts_to_order || 0) : '—'}
              hint="Accepted lines not yet ordered"
            />
            <KpiCard
              {...KPI_ICONS.waiting}
              title="Waiting for Parts"
              value={summary ? String(summary.parts_ordered || 0) : '—'}
              hint="Ordered — not yet received"
            />
            <KpiCard
              {...KPI_ICONS.expected}
              title="Parts Expected Today"
              value={summary ? String(summary.parts_expected_today || 0) : '—'}
              hint="ETA / expected today"
            />
            <KpiCard
              {...KPI_ICONS.returns}
              title="Returns Pending"
              value={summary ? String(summary.returns_pending || 0) : '—'}
              hint="Wrong parts / awaiting credit"
            />
            <KpiCard
              {...KPI_ICONS.mot}
              title="MOTs In Progress"
              value={summary ? String(summary.mot_jobs_in_progress || 0) : '—'}
              hint="MOT jobs not yet completed"
            />
          </section>

          {/* Service Bay Status */}
          <div className="panelCard" style={{ marginTop: 16 }}>
            <div className="panelCardHeader">
              <h3 className="panelCardTitle">
                Service Bay Status
                <span className="demoLabel">Demo</span>
              </h3>
            </div>
            <div className="serviceBayGrid">
              {SERVICE_BAYS.map((bay) => (
                <div key={bay.num} className={`bayCard ${bay.status}`}>
                  <div className="bayNum">Bay {bay.num}</div>
                  <div className="bayStatus">{bay.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent jobs + alerts/stats */}
          <div className="dashContentGrid">
            {/* Recent Jobs */}
            <div className="panelCard">
              <div className="panelCardHeader">
                <h3 className="panelCardTitle">Recent Jobs</h3>
                <button
                  type="button"
                  className="panelLinkBtn"
                  onClick={() => window.history.pushState({}, '', '/jobs') || window.dispatchEvent(new PopStateEvent('popstate'))}
                >
                  View all →
                </button>
              </div>
              {recentJobs.length > 0 ? (
                recentJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    className="recentJobRow"
                    onClick={() => {
                      window.history.pushState({}, '', `/jobs/${job.id}`)
                      window.dispatchEvent(new PopStateEvent('popstate'))
                    }}
                  >
                    <div className="recentJobAvatar">
                      {customerInitials(job.customer_name || job.customer || '')}
                    </div>
                    <div className="recentJobInfo">
                      <div className="recentJobCustomer">
                        {job.customer_name || job.customer || `Job #${job.id}`}
                      </div>
                      <div className="recentJobReg">
                        {job.registration || job.reg || ''}
                        {job.make ? ` · ${job.make}` : ''}
                        {job.model ? ` ${job.model}` : ''}
                      </div>
                    </div>
                    {job.status ? (
                      <span className={`statusChip ${getStatusChipClass(job.status)}`}>
                        {job.status}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="emptyState" style={{ marginTop: 0 }}>
                  {summary === null ? 'Loading recent jobs…' : 'No recent jobs to display.'}
                </div>
              )}
            </div>

            {/* Alerts + Quick Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="panelCard">
                <div className="panelCardHeader">
                  <h3 className="panelCardTitle">Alerts</h3>
                </div>
                {alerts.map((a, i) => (
                  <div key={i} className={`alertItem ${a.type}`}>
                    <div className="alertDot" />
                    <span className="alertText">{a.text}</span>
                  </div>
                ))}
              </div>

              <div className="panelCard">
                <div className="panelCardHeader">
                  <h3 className="panelCardTitle">Workshop</h3>
                </div>
                <div>
                  <div className="quickStatRow">
                    <span className="quickStatLabel">Bay Capacity</span>
                    <span className="quickStatValue">{capacityPct}%</span>
                  </div>
                  <div className="progressBar">
                    <div className="progressFill" style={{ width: `${capacityPct}%` }} />
                  </div>
                  <div className="quickStatRow" style={{ marginTop: 10 }}>
                    <span className="quickStatLabel">Parts Ordered</span>
                    <span className="quickStatValue accent">{summary ? String(summary.parts_ordered || 0) : '—'}</span>
                  </div>
                  <div className="quickStatRow">
                    <span className="quickStatLabel">Parts Expected Today</span>
                    <span className="quickStatValue positive">{summary ? String(summary.parts_expected_today || 0) : '—'}</span>
                  </div>
                  <div className="quickStatRow">
                    <span className="quickStatLabel">MOTs In Progress</span>
                    <span className="quickStatValue">{summary ? String(summary.mot_jobs_in_progress || 0) : '—'}</span>
                  </div>
                </div>
              </div>

              <div className="panelCard">
                <div className="panelCardHeader">
                  <h3 className="panelCardTitle">Quick Actions</h3>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <button type="button" className="primaryButton" style={{ width: '100%', height: 38 }} onClick={onStartNewIntake}>
                    + New Onboarding
                  </button>
                  <button type="button" className="secondaryButton" style={{ width: '100%', height: 38 }} onClick={onViewJobsNeedingQuote}>
                    Jobs Needing Quote
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error ? <div className="notice bad" style={{ marginTop: 12 }}>{error}</div> : null}
        </div>
      ) : tab === 'calendar' ? (
        <Calendar embedded />
      ) : (
        <Kanban embedded />
      )}
    </div>
  )
}

function getStatusChipClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('progress') || s.includes('active')) return 'chipGrey'
  if (s.includes('wait') || s.includes('parts')) return 'chipOrange'
  if (s.includes('complete') || s.includes('done')) return 'chipGreen'
  if (s.includes('quote') || s.includes('pending')) return 'chipPurple'
  if (s.includes('cancel')) return 'chipRed'
  return 'chipGrey'
}

function KpiCard({ title, value, hint, icon, colour, onClick }) {
  const Tag = onClick ? 'button' : 'article'
  return (
    <Tag
      className="kpiCard"
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer', textAlign: 'left', width: '100%' } : undefined}
    >
      <div className="kpiCardHeader">
        <div className={`kpiIconBadge ${colour}`} aria-hidden="true">
          {icon}
        </div>
      </div>
      <div>
        <div className="kpiValue">{value}</div>
        <div className="kpiLabel">{title}</div>
        {hint && <div className="kpiHint">{hint}</div>}
      </div>
    </Tag>
  )
}
