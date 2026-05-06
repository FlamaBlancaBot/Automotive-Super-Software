import { NAV_ITEMS } from '../config/navigation'
import { APP_VERSION } from '../config/version'

const ICON_STYLE = {
  width: 20,
  height: 20,
  display: 'block',
  flexShrink: 0,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function IconHome()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> }
function IconPlus()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function IconSearch()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function IconWrench()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> }
function IconFile()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> }
function IconPackage()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27,6.96 12,12.01 20.73,6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> }
function IconClipboard(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M9 14l2 2 4-4"/></svg> }
function IconSettings() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
function IconLogout()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={ICON_STYLE}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> }
function IconCar()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22, display: 'block', strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> }

const NAV_ICON = {
  'dashboard':  <IconHome />,
  'new-intake': <IconPlus />,
  'search':     <IconSearch />,
  'jobs':       <IconWrench />,
  'quotes':     <IconFile />,
  'parts':      <IconPackage />,
  'mot':        <IconClipboard />,
  'settings':   <IconSettings />,
}

const MAIN_KEYS = ['dashboard', 'new-intake', 'search', 'jobs', 'quotes', 'parts', 'mot']

export default function Sidebar({ activeKey, onNavigate, isOpen, onClose, onLogout }) {
  function nav(key) {
    onNavigate(key)
    if (typeof onClose === 'function') onClose()
  }

  return (
    <>
      <div
        className={`sidebarOverlay ${isOpen ? 'isOpen' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside className={`sidebar ${isOpen ? 'isOpen' : ''}`}>
        <button
          type="button"
          className="sidebarLogo"
          onClick={() => nav('dashboard')}
          title={`AUTOSS v${APP_VERSION}`}
        >
          <IconCar />
        </button>

        <nav className="nav" aria-label="Primary navigation">
          {NAV_ITEMS.filter((x) => !x.hidden && MAIN_KEYS.includes(x.key)).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`navItem ${activeKey === item.key ? 'active' : ''}`}
              onClick={() => nav(item.key)}
              aria-label={item.label}
            >
              <span className="navIcon">{NAV_ICON[item.key]}</span>
              <span className="navTooltip">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebarBottom">
          <button
            type="button"
            className={`navItem ${activeKey === 'settings' ? 'active' : ''}`}
            onClick={() => nav('settings')}
            aria-label="Settings"
          >
            <span className="navIcon"><IconSettings /></span>
            <span className="navTooltip">Settings</span>
          </button>
          {typeof onLogout === 'function' && (
            <button
              type="button"
              className="navItem navLogout"
              onClick={onLogout}
              aria-label="Log out"
            >
              <span className="navIcon"><IconLogout /></span>
              <span className="navTooltip">Log out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
