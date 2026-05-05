import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { APP_SHORT_NAME, APP_LONG_NAME } from '../config/branding'
import { APP_VERSION } from '../config/version'

const LOCAL_FALLBACK_USERS = [
  { id: 'test-admin', name: 'Admin User', email: 'admin@autoss.local', role: 'admin' },
  { id: 'test-office', name: 'Office User', email: 'office@autoss.local', role: 'office' },
  { id: 'test-technician', name: 'Technician User', email: 'technician@autoss.local', role: 'technician' },
]

export default function Login({ onLoggedIn }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState(LOCAL_FALLBACK_USERS)
  const [selectedUserId, setSelectedUserId] = useState(LOCAL_FALLBACK_USERS[0].id)

  useEffect(() => {
    setDocumentTitle('Sign In')
    async function loadUsers() {
      try {
        const out = await apiGet('/api/auth/users')
        const list = Array.isArray(out?.users) && out.users.length ? out.users : LOCAL_FALLBACK_USERS
        setUsers(list)
        setSelectedUserId(String(list[0].id))
      } catch {
        setUsers(LOCAL_FALLBACK_USERS)
        setSelectedUserId(LOCAL_FALLBACK_USERS[0].id)
      }
    }
    loadUsers()
  }, [])

  async function onSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const out = await apiPost('/api/auth/select-user', { user_id: selectedUserId })
      if (out?.ok && out.user && typeof onLoggedIn === 'function') onLoggedIn(out.user)
    } catch (err) {
      setError(err.message || 'Could not continue. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="loginBrand">
          <div className="loginIconBadge" aria-hidden="true">🔧</div>
          <div className="loginTitle">{APP_SHORT_NAME}</div>
          <div className="loginSubtitle">{APP_LONG_NAME} · v{APP_VERSION}</div>
        </div>

        <div className="notice info" style={{ marginBottom: 16, marginTop: 0 }}>
          Testing mode — select a user to continue.
        </div>

        <form onSubmit={onSubmit}>
          <div className="field" style={{ gridColumn: 'span 12', marginBottom: 14 }}>
            <label className="fieldLabel" htmlFor="loginUserSelect">Sign in as</label>
            <select
              id="loginUserSelect"
              className="select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {(users || []).map((u) => (
                <option key={String(u.id)} value={String(u.id)}>
                  {u.name} ({u.role}) — {u.email}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="notice bad" style={{ marginBottom: 12 }}>{error}</div>
          ) : null}

          <button
            className="primaryButton"
            type="submit"
            disabled={busy}
            style={{ width: '100%', height: 42, fontSize: 14, borderRadius: 12 }}
          >
            {busy ? 'Continuing…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
