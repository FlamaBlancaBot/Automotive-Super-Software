import { APP_LONG_NAME, APP_SHORT_NAME, LOGO_URL } from '../config/branding'

export default function TopBar({
  onToggleNav,
  onNewIntake,
  onSetup,
  onSearch,
  user,
  onLogout,
}) {
  return (
    <header className="topBar">
      <button
        type="button"
        className="menuButton"
        onClick={onToggleNav}
        aria-label="Open navigation"
      >
        <span className="menuIcon" aria-hidden="true">
          ☰
        </span>
      </button>

      <div className="brand">
        <img className="brandLogo" src={LOGO_URL} alt="" />
        <div className="brandText">
          <div className="brandShort">{APP_SHORT_NAME}</div>
          <div className="brandLong">{APP_LONG_NAME}</div>
        </div>
      </div>

      <div className="topBarRight">
        <form
          className="topSearch"
          onSubmit={(e) => {
            e.preventDefault()
            const form = e.currentTarget
            const input = form.elements.namedItem('q')
            const value = input && input.value ? String(input.value).trim() : ''
            if (value && typeof onSearch === 'function') onSearch(value)
          }}
        >
          <input
            className="input topSearchInput"
            name="q"
            placeholder="Search REG / customer / job…"
            aria-label="Global search"
            autoComplete="off"
          />
        </form>
        <button type="button" className="primaryButton" onClick={onNewIntake}>
          New Intake
        </button>
        <button
          type="button"
          className="secondaryButton"
          onClick={onSetup}
          title="Database status/init/seed"
        >
          Set-up
        </button>
        {user ? (
          <>
            <div className="topUserBadge" title={user.email || ''}>
              {user.name || user.email} · {String(user.role || '').toUpperCase()}
            </div>
            <button type="button" className="secondaryButton" onClick={onLogout}>
              Logout
            </button>
          </>
        ) : null}
      </div>
    </header>
  )
}
