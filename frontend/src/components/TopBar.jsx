import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPatch, apiPost } from '../api/http'
import { APP_VERSION } from '../config/version'

function userInitials(user) {
  if (!user) return '?'
  const name = user.name || user.email || ''
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, display: 'block', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

function playBeepForSeverity(severity) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = severity === 'danger' ? 280 : severity === 'warning' ? 420 : 620
    gain.gain.value = 0.0001
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    osc.start(now)
    osc.stop(now + 0.26)
    osc.onended = () => { ctx.close().catch(() => {}) }
  } catch {
    // ignore autoplay/audio failures
  }
}

export default function TopBar({ onToggleNav, onSearch, pageTitle, user }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [toasts, setToasts] = useState([])
  const toastTimers = useRef(new Map())
  const notifWrapRef = useRef(null)
  const seenIds = useRef(new Set())

  async function loadNotifications(initial = false) {
    try {
      const [notifRes, settingRes] = await Promise.all([
        apiGet('/api/notifications?limit=25').catch(() => ({ notifications: [], unread_count: 0 })),
        apiGet('/api/settings/notifications').catch(() => ({ settings: { sound_enabled: true } })),
      ])
      const rows = notifRes.notifications || []
      setNotifications(rows)
      setUnreadCount(Number(notifRes.unread_count || 0))
      setSoundEnabled(Boolean(settingRes?.settings?.sound_enabled ?? true))

      if (initial) {
        for (const r of rows) seenIds.current.add(r.id)
      } else {
        const freshRows = rows.filter((r) => !seenIds.current.has(r.id) && !r.read_at)
        for (const r of rows) seenIds.current.add(r.id)
        if (freshRows.length) {
          setToasts((prev) => {
            const existing = new Set(prev.map((t) => t.id))
            const add = freshRows
              .filter((r) => !existing.has(r.id))
              .map((r) => ({ id: r.id, title: r.title, message: r.message, severity: String(r.severity || 'info').toLowerCase() }))
            return [...add, ...prev].slice(0, 6)
          })
          if (soundEnabled) {
            const audible = freshRows.find((r) => ['success', 'warning', 'danger'].includes(String(r.severity || '').toLowerCase()) && r.sound_key)
            if (audible) playBeepForSeverity(String(audible.severity || 'info').toLowerCase())
          }
        }
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadNotifications(true)
    const timer = setInterval(() => loadNotifications(false), 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    function onClickOutside(event) {
      if (!open) return
      if (notifWrapRef.current && !notifWrapRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    for (const t of toasts) {
      if (toastTimers.current.has(t.id)) continue
      const ms = t.severity === 'warning' || t.severity === 'danger' ? 8000 : 5000
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id))
        toastTimers.current.delete(t.id)
      }, ms)
      toastTimers.current.set(t.id, timer)
    }
  }, [toasts])

  useEffect(() => () => {
    for (const timer of toastTimers.current.values()) clearTimeout(timer)
    toastTimers.current.clear()
  }, [])

  function dismissToast(id) {
    const timer = toastTimers.current.get(id)
    if (timer) clearTimeout(timer)
    toastTimers.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  async function markRead(id) {
    await apiPatch(`/api/notifications/${id}/read`, {}).catch(() => {})
    await loadNotifications(false)
  }

  async function markAllRead() {
    await apiPost('/api/notifications/mark-all-read', {}).catch(() => {})
    await loadNotifications(false)
  }

  return (
    <header className="topBar">
      <div className="topBarLeft">
        <button type="button" className="menuButton" onClick={onToggleNav} aria-label="Open navigation">
          <span className="menuIcon" aria-hidden="true">☰</span>
        </button>
        {pageTitle && (
          <div className="topBarTitleGroup">
            <h1 className="topBarTitle">{pageTitle}</h1>
            <span className="topBarVersion">v{APP_VERSION}</span>
          </div>
        )}
      </div>

      <form
        className="topSearch"
        onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.elements.namedItem('q')
          const value = input && input.value ? String(input.value).trim() : ''
          if (value && typeof onSearch === 'function') onSearch(value)
        }}
      >
        <input className="topSearchInput" name="q" placeholder="Search REG / customer / job…" aria-label="Global search" autoComplete="off" />
      </form>

      <div className="topBarRight">
        <div className="topNotifWrap" ref={notifWrapRef}>
          <button type="button" className="topBarIconBtn" title="Notifications" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
            <BellIcon />
            {unreadCount > 0 ? <span className="topNotifBadge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
          </button>
          {open ? (
            <div className="topNotifDropdown">
              <div className="topNotifHeader">
                <strong>Notifications</strong>
                <button type="button" className="miniButton" onClick={async () => { await markAllRead(); setOpen(false) }}>Mark all read</button>
              </div>
              <div className="topNotifList">
                {notifications.length ? notifications.map((n) => (
                  <div key={n.id} className={`topNotifItem ${n.read_at ? 'isRead' : 'isUnread'}`}>
                    <div className={`statusChip ${n.severity === 'danger' ? 'chipRed' : n.severity === 'warning' ? 'chipYellow' : n.severity === 'success' ? 'chipGreen' : 'chipGrey'}`}>{n.severity || 'info'}</div>
                    <div className="topNotifText">
                      <div className="topNotifTitle">{n.title}</div>
                      <div className="fieldHint">{n.message}</div>
                      {n.action_url ? <a href={n.action_url} onClick={() => setOpen(false)}>Open</a> : null}
                    </div>
                    {!n.read_at ? <button type="button" className="miniButton" onClick={async () => { await markRead(n.id); }}>Read</button> : null}
                  </div>
                )) : <div className="emptyState" style={{ marginTop: 8 }}>No notifications yet.</div>}
              </div>
            </div>
          ) : null}
        </div>
        <div className="topToastStack" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`topToast ${t.severity === 'danger' ? 'isDanger' : t.severity === 'warning' ? 'isWarning' : t.severity === 'success' ? 'isSuccess' : 'isInfo'}`}>
              <div>
                <div className="topToastTitle">{t.title}</div>
                <div className="fieldHint">{t.message}</div>
              </div>
              <button type="button" className="miniButton" onClick={() => dismissToast(t.id)}>Close</button>
            </div>
          ))}
        </div>

        {user ? (
          <div className="topUserBadge" title={user.email || ''}>
            <div className="userAvatar" aria-hidden="true">{userInitials(user)}</div>
            <div className="topUserInfo">
              <span className="topUserName">{user.name || user.email}</span>
              <span className="topUserRole">{String(user.role || '').toUpperCase()}</span>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  )
}
