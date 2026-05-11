import { NAV_ITEMS } from '../config/navigation'
import { APP_VERSION } from '../config/version'

/* ── Icon SVG components ── */
const ICO_STYLE = { width: 20, height: 20, display: 'block', strokeLinecap: 'round', strokeLinejoin: 'round', color: 'inherit' }

function IcoHome()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> }
function IcoPlus()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function IcoSearch()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function IcoWrench()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> }
function IcoFile()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg> }
function IcoChart()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function IcoMessage()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
function IcoPackage()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IcoClipboard()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> }
function IcoSettings()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/></svg> }
function IcoLogout()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICO_STYLE}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function IcoCar()       { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22, display: 'block', strokeLinecap: 'round', strokeLinejoin: 'round', color: 'inherit' }}><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> }

const ICON_MAP = {
  dashboard:  <IcoHome />,
  'new-intake': <IcoPlus />,
  search:     <IcoSearch />,
  jobs:       <IcoWrench />,
  reports:    <IcoChart />,
  communications: <IcoMessage />,
  quotes:     <IcoFile />,
  parts:      <IcoPackage />,
  inventory:  <IcoPackage />,
  mot:        <IcoClipboard />,
  settings:   <IcoSettings />,
}

export default function Sidebar({ activeKey, onNavigate, isOpen, onClose, onLogout }) {
  function nav(key) {
    onNavigate(key)
    if (typeof onClose === 'function') onClose()
  }

  const visibleItems = NAV_ITEMS.filter(x => !x.hidden && x.key !== 'settings')

  return (
    <>
      <div
        className={`sidebarOverlay ${isOpen ? 'isOpen' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside className={`sidebar ${isOpen ? 'isOpen' : ''}`}>
        <div className="sidebarTop">
          {/* Logo badge at top */}
          <button
            type="button"
            className="sidebarLogo"
            onClick={() => nav('dashboard')}
            title={`AUTOSS v${APP_VERSION}`}
            aria-label="Dashboard"
          >
            <IcoCar />
          </button>
        </div>

        {/* Main nav */}
        <nav className="sidebarNav" aria-label="Primary navigation">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`navItem ${activeKey === item.key ? 'active' : ''}`}
              onClick={() => nav(item.key)}
              title={item.label}
              aria-label={item.label}
              aria-current={activeKey === item.key ? 'page' : undefined}
            >
              <span className="navIcon">
                {ICON_MAP[item.key] || ICON_MAP.dashboard}
              </span>
              <span className="navTooltip">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom section: settings + logout */}
        <div className="sidebarBottom">
          <button
            type="button"
            className={`navItem ${activeKey === 'settings' ? 'active' : ''}`}
            onClick={() => nav('settings')}
            title="Settings"
            aria-label="Settings"
            aria-current={activeKey === 'settings' ? 'page' : undefined}
          >
            <span className="navIcon"><IcoSettings /></span>
            <span className="navTooltip">Settings</span>
          </button>
          {typeof onLogout === 'function' && (
            <button
              type="button"
              className="navItem navLogout"
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
            >
              <span className="navIcon"><IcoLogout /></span>
              <span className="navTooltip">Log out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
