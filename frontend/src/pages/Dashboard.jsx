import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import { APP_LONG_NAME, APP_SHORT_NAME } from '../config/branding'
import Calendar from './Calendar'
import Kanban from './Kanban'

const KPI_ICONS = {
  jobs:     { icon: '🔧', colour: 'blue' },
  quote:    { icon: '📋', colour: 'orange' },
  chase:    { icon: '📞', colour: 'purple' },
  parts:    { icon: '📦', colour: 'cyan' },
  waiting:  { icon: '⏳', colour: 'orange' },
  expected: { icon: '🚚', colour: 'green' },
  returns:  { icon: '↩️', colour: 'red' },
  mot:      { icon: '✅', colour: 'green' },
}

export default function Dashboard({ onStartNewIntake, onViewJobsNeedingQuote }) {
  const [summary, setSummary] = useState(null)
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

  const tabs = useMemo(() => [
    { key: 'overview', label: 'Overview' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'kanban', label: 'Kanban' },
  ], [])

  return (
    <div className="dashboard">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">{APP_SHORT_NAME}</h2>
          <p className="pageSubtitle">{APP_LONG_NAME}</p>
        </div>
        <div className="pageHeaderActions">
          <button type="button" className="primaryButton" onClick={onStartNewIntake}>
            + Onboarding
          </button>
          <button type="button" className="secondaryButton" onClick={onViewJobsNeedingQuote}>
            Jobs Needing Quote
          </button>
          <span className="setupPill">Early preview</span>
        </div>
      </header>

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
      ) : tab === 'calendar' ? (
        <Calendar embedded />
      ) : (
        <Kanban embedded />
      )}

      {error ? <div className="notice bad" style={{ marginTop: 12 }}>{error}</div> : null}

      <section className="callout" style={{ marginTop: 16 }}>
        <h3 className="calloutTitle">Set-up phase</h3>
        <p className="calloutText">
          Early MVP — login permissions and deeper workflows will be added in later stages.
        </p>
      </section>
    </div>
  )
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
