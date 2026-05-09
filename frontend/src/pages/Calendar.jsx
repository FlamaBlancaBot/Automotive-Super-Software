import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import VehicleHeader from '../components/VehicleHeader'
import StatusChip from '../components/StatusChip'
import { setDocumentTitle } from '../utils/title'

function toDateInput(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtDayLabel(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })
}

function minutesFromMidnight(dateTimeStr) {
  const d = new Date(String(dateTimeStr).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return null
  return d.getHours() * 60 + d.getMinutes()
}

function parseDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(String(dateStr).replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function getDaysBetween(startStr, endStr) {
  const start = parseDate(startStr)
  const end = parseDate(endStr)
  if (!start || !end) return [startStr ? toDateInput(start) : null].filter(Boolean)

  const days = []
  const current = new Date(start)
  current.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(0, 0, 0, 0)

  while (current <= endDate) {
    days.push(toDateInput(current))
    current.setDate(current.getDate() + 1)
  }
  return days
}

function statusTone(colour, faded) {
  if (faded) return 'chipGrey'
  if (colour === 'green') return 'chipGreen'
  if (colour === 'red') return 'chipRed'
  if (colour === 'orange') return 'chipOrange'
  if (colour === 'purple') return 'chipPurple'
  return 'chipGrey'
}

const STATUS_FILTERS = {
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  waiting_parts: 'Waiting Parts',
  mot: 'MOT',
  needs_quote: 'Needs Quote',
  ready_to_collect: 'Ready to Collect'
}

export default function Calendar({ embedded = false }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [includeInactive, setIncludeInactive] = useState(false)
  const [statusFilters, setStatusFilters] = useState(Object.keys(STATUS_FILTERS).reduce((acc, k) => ({ ...acc, [k]: true }), {}))
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    if (!embedded) setDocumentTitle('Calendar')
  }, [embedded])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const start = toDateInput(days[0])
  const end = toDateInput(days[6])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const data = await apiGet(`/api/calendar/jobs?start=${start}&end=${end}&includeInactive=${includeInactive ? 'true' : 'false'}`)
      setJobs(data.jobs || [])
      setStatus('ready')
    } catch (err) {
      setError(err.message || 'Failed to load calendar jobs.')
      setStatus('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, includeInactive])

  const jobsByDate = useMemo(() => {
    const map = new Map(days.map((d) => [toDateInput(d), []]))
    for (const j of jobs || []) {
      const statusKey = (j.status?.toLowerCase().replace(/\s+/g, '_') || 'in_progress')
      const isFiltered = statusKey in statusFilters
      if (isFiltered && !statusFilters[statusKey]) continue

      const spanDays = getDaysBetween(j.booked_start, j.booked_end)
      for (const dayKey of spanDays) {
        if (map.has(dayKey)) {
          map.get(dayKey).push(j)
        }
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ma = minutesFromMidnight(a.booked_start) ?? 0
        const mb = minutesFromMidnight(b.booked_start) ?? 0
        return ma - mb
      })
    }
    return map
  }, [jobs, days, statusFilters])

  function openJob(jobId) {
    window.history.pushState({}, '', `/jobs/${jobId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <div className="calendarPage">
      {!embedded ? (
        <header className="pageHeader">
          <div>
            <h2 className="pageTitle">Calendar</h2>
            <p className="pageSubtitle">Workshop week planner</p>
          </div>
        </header>
      ) : null}

      <div className="cardBox">
        <div className="pageHeaderActions" style={{ justifyContent: 'space-between' }}>
          <div className="pageHeaderActions">
            <button type="button" className="miniButton" onClick={() => setWeekStart((d) => addDays(d, -7))}>Previous</button>
            <button type="button" className="miniButton" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</button>
            <button type="button" className="miniButton" onClick={() => setWeekStart((d) => addDays(d, 7))}>Next</button>
          </div>
          <label className="inlineCheck">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            <span>Show inactive / unbooked jobs</span>
          </label>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--separator)' }}>
          {Object.entries(STATUS_FILTERS).map(([key, label]) => (
            <label key={key} className="inlineCheck">
              <input
                type="checkbox"
                checked={statusFilters[key]}
                onChange={(e) => setStatusFilters(prev => ({ ...prev, [key]: e.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {error ? <div className="notice bad" style={{ marginTop: 10 }}>{error}</div> : null}

        {status === 'loading' ? <div className="emptyState" style={{ marginTop: 12 }}>Loading…</div> : (
          <div className="calendarWeekGrid" style={{ marginTop: 12 }}>
            {days.map((day) => {
              const key = toDateInput(day)
              const list = jobsByDate.get(key) || []
              return (
                <div key={key} className="calendarDayCol">
                  <div className="calendarDayHead">{fmtDayLabel(day)}</div>
                  <div className="calendarDayBody">
                    {list.length ? list.map((j) => {
                      const startMin = minutesFromMidnight(j.booked_start)
                      const endMin = minutesFromMidnight(j.booked_end)
                      const duration = Math.max(30, (endMin != null && startMin != null) ? (endMin - startMin) : Number(j.estimated_duration_minutes || 60))
                      const top = startMin != null ? Math.max(0, (startMin - 8 * 60) * 0.8) : 0
                      const height = Math.max(32, duration * 0.8)
                      return (
                        <button key={j.id} type="button" className={`calendarJobCard ${j.faded ? 'faded' : ''}`} style={{ top: `${top}px`, height: `${height}px` }} onClick={() => openJob(j.id)}>
                          <VehicleHeader small reg={j.registration} make={j.vehicle_make} model={j.vehicle_model} />
                          <div className="fieldHint" style={{ marginTop: 4 }}>{j.customer_name}</div>
                          <div style={{ fontWeight: 800, marginTop: 2, fontSize: 12 }}>{j.title}</div>
                          <div className="pageHeaderActions" style={{ marginTop: 4, justifyContent: 'flex-start', gap: 6 }}>
                            <StatusChip label={j.status_label || j.status} tone={statusTone(j.status_colour, j.faded)} />
                            {j.quote_status ? <span className="fieldHint">Quote {j.quote_status}</span> : null}
                            {j.parts_status && j.parts_status !== 'none' ? <span className="fieldHint">Parts {j.parts_status}</span> : null}
                          </div>
                        </button>
                      )
                    }) : <div className="fieldHint" style={{ padding: 8 }}>No jobs</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
