import { useEffect, useMemo, useState } from 'react'
import './App.css'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import NewIntake from './pages/NewIntake'
import Jobs from './pages/Jobs'
import JobDetail from './pages/JobDetail'
import Quotes from './pages/Quotes'
import QuoteDetail from './pages/QuoteDetail'
import Setup from './pages/Setup'
import PartsOrders from './pages/PartsOrders'
import Settings from './pages/Settings'
import JobSheets from './pages/JobSheets'
import JobSheetDetail from './pages/JobSheetDetail'
import Vehicles from './pages/Vehicles'
import Suppliers from './pages/Suppliers'
import Search from './pages/Search'
import Reports from './pages/Reports'
import PlaceholderPage from './pages/PlaceholderPage'
import Login from './pages/Login'
import CustomerDetailsRequest from './pages/CustomerDetailsRequest'
import MotEvents from './pages/MotEvents'
import InvoiceDetail from './pages/InvoiceDetail'
import { NAV_ITEMS } from './config/navigation'
import { setDocumentTitle } from './utils/title'
import { apiGet, apiPost } from './api/http'

function stripQuery(path) {
  return String(path || '').split('?')[0].split('#')[0]
}

function getKeyFromPath(pathname) {
  const clean = stripQuery(pathname)
  if (clean && clean.startsWith('/quotes/')) return 'quotes'
  if (clean && clean.startsWith('/jobs/')) return 'jobs'
  if (clean && clean.startsWith('/job-sheets/')) return 'job-sheets'
  if (clean && clean.startsWith('/invoices/')) return 'invoices'
  if (clean && clean.startsWith('/search')) return 'search'
  const match = NAV_ITEMS.find((x) => x.path === clean)
  return match ? match.key : 'dashboard'
}

function getPathFromKey(key) {
  const match = NAV_ITEMS.find((x) => x.key === key)
  return match ? match.path : '/'
}

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = window.localStorage.getItem('autoss_theme')
    return saved === 'light' ? 'light' : 'dark'
  })
  const [pathname, setPathname] = useState(
    () => `${window.location.pathname}${window.location.search}`,
  )
  const [activeKey, setActiveKey] = useState(() =>
    getKeyFromPath(`${window.location.pathname}${window.location.search}`),
  )
  const [navOpen, setNavOpen] = useState(false)
  const [authStatus, setAuthStatus] = useState('loading')
  const [authUser, setAuthUser] = useState(null)

  const activeLabel = useMemo(() => {
    const match = NAV_ITEMS.find((x) => x.key === activeKey)
    return match ? match.label : 'Dashboard'
  }, [activeKey])

  useEffect(() => {
    const match = NAV_ITEMS.find((x) => x.key === activeKey)
    setDocumentTitle(match ? match.title : activeLabel)
  }, [activeKey, activeLabel])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('autoss_theme', theme)
  }, [theme])

  useEffect(() => {
    function onPopState() {
      const next = `${window.location.pathname}${window.location.search}`
      setPathname(next)
      setActiveKey(getKeyFromPath(next))
      setNavOpen(false)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    async function checkAuth() {
      try {
        const out = await apiGet('/api/auth/me')
        setAuthUser(out.user || null)
        setAuthStatus('ready')
      } catch {
        setAuthUser(null)
        setAuthStatus('guest')
      }
    }
    checkAuth()
  }, [])

  function navigate(nextKey) {
    const nextPath = getPathFromKey(nextKey)
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
    setActiveKey(getKeyFromPath(nextPath))
    setNavOpen(false)
  }

  function navigateToPath(nextPath) {
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setPathname(nextPath)
    setActiveKey(getKeyFromPath(nextPath))
    setNavOpen(false)
  }

  const quoteIdFromPath = useMemo(() => {
    const m = stripQuery(pathname).match(/^\/quotes\/(\d+)$/)
    return m && m[1] ? Number(m[1]) : null
  }, [pathname])

  const jobIdFromPath = useMemo(() => {
    const m = stripQuery(pathname).match(/^\/jobs\/(\d+)$/)
    return m && m[1] ? Number(m[1]) : null
  }, [pathname])

  const jobSheetIdFromPath = useMemo(() => {
    const m = stripQuery(pathname).match(/^\/job-sheets\/(\d+)$/)
    return m && m[1] ? Number(m[1]) : null
  }, [pathname])

  const invoiceIdFromPath = useMemo(() => {
    const m = stripQuery(pathname).match(/^\/invoices\/(\d+)$/)
    return m && m[1] ? Number(m[1]) : null
  }, [pathname])

  const publicCustomerDetailsToken = useMemo(() => {
    const m = stripQuery(pathname).match(/^\/customer-details\/([^/]+)$/)
    return m && m[1] ? decodeURIComponent(m[1]) : null
  }, [pathname])

  const isLoginPath = stripQuery(pathname) === '/login'

  async function logout() {
    try {
      await apiPost('/api/auth/logout', {})
    } catch {}
    setAuthUser(null)
    setAuthStatus('guest')
    navigateToPath('/login')
  }

  return (
    <div className="app">
      {publicCustomerDetailsToken ? (
        <main className="main publicOnly" role="main">
          <CustomerDetailsRequest token={publicCustomerDetailsToken} />
        </main>
      ) : authStatus === 'loading' ? (
        <main className="main publicOnly" role="main">
          <div className="emptyState">Checking session…</div>
        </main>
      ) : !authUser ? (
        <main className="main publicOnly" role="main">
          {isLoginPath ? (
            <Login
              onLoggedIn={(user) => {
                setAuthUser(user || null)
                setAuthStatus('ready')
                navigateToPath('/')
              }}
            />
          ) : (
            <Login
              onLoggedIn={(user) => {
                setAuthUser(user || null)
                setAuthStatus('ready')
                navigateToPath('/')
              }}
            />
          )}
        </main>
      ) : (
        <>
          <Sidebar
            activeKey={activeKey}
            onNavigate={navigate}
            isOpen={navOpen}
            onClose={() => setNavOpen(false)}
            onLogout={logout}
          />
          <div className="appPanel">
          <TopBar
            onToggleNav={() => setNavOpen(true)}
            onSearch={(q) =>
              navigateToPath(`/search?q=${encodeURIComponent(String(q || '').trim())}`)
            }
            pageTitle={activeLabel}
            user={authUser}
          />
            <main className="main" role="main">
          {activeKey === 'dashboard' ? (
            <Dashboard
              onStartNewIntake={() => navigate('new-intake')}
              onViewJobsNeedingQuote={() => navigateToPath('/jobs?needs_quote=1')}
            />
          ) : activeKey === 'reports' ? (
            <Reports />
          ) : activeKey === 'new-intake' ? (
            <NewIntake
              locationPath={pathname}
              onOpenQuote={(id) => navigateToPath(`/quotes/${id}`)}
              onViewJob={(id) => navigateToPath(`/jobs/${id}`)}
              onStartAnother={() => navigateToPath('/intake')}
            />
          ) : activeKey === 'jobs' ? (
            jobIdFromPath ? (
              <JobDetail
                jobId={jobIdFromPath}
                onBackToJobs={() => navigateToPath('/jobs')}
                onOpenQuote={(id) => navigateToPath(`/quotes/${id}`)}
                onViewPartsOrders={(jobId) => navigateToPath(`/parts?job_id=${jobId}`)}
                onOpenJobSheet={(id) => navigateToPath(`/job-sheets/${id}`)}
                onOpenInvoice={(id) => navigateToPath(`/invoices/${id}`)}
              />
            ) : (
              <Jobs
                locationPath={pathname}
                onOpenJob={(id) => navigateToPath(`/jobs/${id}`)}
                onOpenQuote={(id) => navigateToPath(`/quotes/${id}`)}
              />
            )
          ) : activeKey === 'setup' ? (
            <Setup />
          ) : activeKey === 'parts' ? (
            <PartsOrders locationPath={pathname} />
          ) : activeKey === 'settings' ? (
            <Settings
              onOpenSetup={() => navigate('setup')}
              theme={theme}
              onThemeChange={setTheme}
              userRole={authUser?.role}
            />
          ) : activeKey === 'vehicles' ? (
            <Vehicles onOpenIntake={(reg) => navigateToPath(`/intake?reg=${encodeURIComponent(reg)}`)} />
          ) : activeKey === 'suppliers' ? (
            <Suppliers />
          ) : activeKey === 'search' ? (
            <Search
              locationPath={pathname}
              onOpenJob={(id) => navigateToPath(`/jobs/${id}`)}
              onOpenQuote={(id) => navigateToPath(`/quotes/${id}`)}
              onOpenPartsOrders={(orderId) => navigateToPath(`/parts?q=${encodeURIComponent(String(orderId))}`)}
              onOpenVehicle={(reg) => navigateToPath(`/intake?reg=${encodeURIComponent(reg)}`)}
            />
          ) : activeKey === 'mot' ? (
            <MotEvents onOpenQuote={(id) => navigateToPath(`/quotes/${id}`)} />
          ) : activeKey === 'job-sheets' ? (
            jobSheetIdFromPath ? (
              <JobSheetDetail
                jobId={jobSheetIdFromPath}
                onBack={() => navigateToPath('/job-sheets')}
              />
            ) : (
              <JobSheets onOpenJobSheet={(id) => navigateToPath(`/job-sheets/${id}`)} />
            )
          ) : activeKey === 'invoices' ? (
            invoiceIdFromPath ? (
              <InvoiceDetail
                invoiceId={invoiceIdFromPath}
                onBack={() => window.history.back()}
              />
            ) : (
              <PlaceholderPage title="Invoices" />
            )
          ) : activeKey === 'quotes' ? (
            quoteIdFromPath ? (
              <QuoteDetail
                quoteId={quoteIdFromPath}
                onBackToQuotes={() => navigate('quotes')}
                onViewPartsOrders={(quoteId) => navigateToPath(`/parts?quote_id=${quoteId}`)}
              />
            ) : (
              <Quotes
                onOpenQuote={(id) => navigateToPath(`/quotes/${id}`)}
                locationPath={pathname}
              />
            )
          ) : (
            <PlaceholderPage title={activeLabel} />
          )}
            </main>
          </div>
        </>
      )}
    </div>
  )
}


export default App
