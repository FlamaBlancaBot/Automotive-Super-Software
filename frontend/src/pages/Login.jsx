import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import { APP_SHORT_NAME } from '../config/branding'

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
    setDocumentTitle('Login | A.S.S')
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
      <div className="cardBox loginCard">
        <h2 className="cardTitle">{APP_SHORT_NAME} sign in</h2>
        <p className="fieldHint">Testing access mode</p>
        <div className="notice info" style={{ marginTop: 10 }}>
          Testing mode — login security will be added later.
        </div>
        <form onSubmit={onSubmit} className="settingsGrid" style={{ marginTop: 12 }}>
          <label className="field" style={{ gridColumn: 'span 12' }}>
            <span className="fieldLabel">Choose user</span>
            <select
              className="select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {(users || []).map((u) => (
                <option key={String(u.id)} value={String(u.id)}>
                  {u.name} ({u.role}) - {u.email}
                </option>
              ))}
            </select>
          </label>
          {error ? <div className="fieldError">{error}</div> : null}
          <div className="settingsActions">
            <button className="primaryButton" type="submit" disabled={busy}>
              {busy ? 'Continuing…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

