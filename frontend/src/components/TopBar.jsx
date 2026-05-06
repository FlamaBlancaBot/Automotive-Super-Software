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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ width: 18, height: 18, display: 'block', strokeLinecap: 'round', strokeLinejoin: 'round' }}
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

export default function TopBar({ onToggleNav, onSearch, pageTitle, user }) {
  return (
    <header className="topBar">
      {/* Left: page title */}
      <div className="topBarLeft">
        <button
          type="button"
          className="menuButton"
          onClick={onToggleNav}
          aria-label="Open navigation"
        >
          <span className="menuIcon" aria-hidden="true">☰</span>
        </button>
        {pageTitle && (
          <h1 className="topBarTitle">{pageTitle}</h1>
        )}
      </div>

      {/* Middle: search */}
      <form
        className="topSearch"
        onSubmit={(e) => {
          e.preventDefault()
          const input = e.currentTarget.elements.namedItem('q')
          const value = input && input.value ? String(input.value).trim() : ''
          if (value && typeof onSearch === 'function') onSearch(value)
        }}
      >
        <input
          className="topSearchInput"
          name="q"
          placeholder="Search REG / customer / job…"
          aria-label="Global search"
          autoComplete="off"
        />
      </form>

      {/* Right: bell + user badge */}
      <div className="topBarRight">
        <button
          type="button"
          className="topBarIconBtn"
          title="Notifications"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>

        {user ? (
          <div className="topUserBadge" title={user.email || ''}>
            <div className="userAvatar" aria-hidden="true">
              {userInitials(user)}
            </div>
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
