import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import { APP_LONG_NAME, APP_SHORT_NAME } from '../config/branding'
import Calendar from './Calendar'
import Kanban from './Kanban'

export default function Dashboard({
  onStartNewIntake,
  onViewJobsNeedingQuote,
}) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview') // overview|calendar|kanban

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
    return () => {
      cancelled = true
    }
  }, [])

  const tabs = useMemo(() => {
    return [
      { key: 'overview', label: 'Overview' },
      { key: 'calendar', label: 'Calendar' },
      { key: 'kanban', label: 'Kanban' },
    ]
  }, [])

  return (
    <div className="dashboard">
      <header className="pageHeader">
        <div>
          <h2 className="pageTitle">{APP_SHORT_NAME}</h2>
          <p className="pageSubtitle">{APP_LONG_NAME}</p>
        </div>
        <div className="pageHeaderActions">
          <button
            type="button"
            className="primaryButton"
            onClick={onStartNewIntake}
          >
            Start Onboarding
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={onViewJobsNeedingQuote}
          >
            View Jobs Needing Quote
          </button>
          <span className="setupPill" title="Early preview">
            Early set-up preview
          </span>
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
          <DashboardCard
            title="Jobs Today"
            value={summary ? String(summary.jobs_booked_today || 0) : '—'}
            hint="Jobs requested/booked today"
          />
          <DashboardCard
            title="Jobs Needing Quote"
            value={summary ? String(summary.jobs_needing_quote || 0) : '—'}
            hint="Open jobs with no quote yet"
          />
          <DashboardCard
            title="Quotes to Chase"
            value={
              summary
                ? String(
                    (summary.quotes_by_status?.sent || 0) +
                      (summary.quotes_by_status?.ready || 0),
                  )
                : '—'
            }
            hint="Ready/sent quotes (follow-up)"
          />
          <DashboardCard
            title="Parts to Order"
            value={summary ? String(summary.parts_to_order || 0) : '—'}
            hint="Accepted quote lines needing ordering"
          />
          <DashboardCard
            title="Waiting for Parts"
            value={summary ? String(summary.parts_ordered || 0) : '—'}
            hint="Ordered parts not yet received"
          />
          <DashboardCard
            title="Parts Expected Today"
            value={summary ? String(summary.parts_expected_today || 0) : '—'}
            hint="Due today (ETA/expected date)"
          />
          <DashboardCard
            title="Returns Pending"
            value={summary ? String(summary.returns_pending || 0) : '—'}
            hint="Wrong parts / returns / awaiting credit"
          />
          <DashboardCard
            title="MOTs In Progress"
            value={summary ? String(summary.mot_jobs_in_progress || 0) : '—'}
            hint="MOT jobs not completed"
          />
        </section>
      ) : tab === 'calendar' ? (
        <Calendar embedded />
      ) : (
        <Kanban embedded />
      )}

      {error ? <div className="notice bad">{error}</div> : null}

      <section className="callout">
        <h3 className="calloutTitle">Set-up phase</h3>
        <p className="calloutText">
          This is an early MVP. Login, permissions, and deeper job/parts workflows
          will be added in later stages.
        </p>
      </section>
    </div>
  )
}

function DashboardCard({ title, value, hint }) {
  return (
    <article className="cardBox">
      <div className="cardTop">
        <h3 className="cardTitle">{title}</h3>
        <span className="cardValue">{value}</span>
      </div>
      <p className="cardHint">{hint}</p>
    </article>
  )
}
