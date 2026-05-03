import { NAV_ITEMS } from '../config/navigation'

export default function Sidebar({
  activeKey,
  onNavigate,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}) {
  return (
    <>
      <div
        className={`sidebarOverlay ${isOpen ? 'isOpen' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={`sidebar ${isOpen ? 'isOpen' : ''} ${isCollapsed ? 'isCollapsed' : ''}`}
      >
        <nav className="nav" aria-label="Primary">
          {NAV_ITEMS.filter((x) => !x.hidden).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`navItem ${item.key === activeKey ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="navIcon" aria-hidden="true">
                {item.icon || '•'}
              </span>
              <span className="navLabel">{item.label}</span>
            </button>
          ))}
        </nav>

        {onToggleCollapse ? (
          <div className="sidebarFooter" style={{ display: 'none' }} />
        ) : null}
      </aside>
    </>
  )
}
