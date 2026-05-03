import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

export default function CustomerDetailsRequest({ token }) {
  const [status, setStatus] = useState('loading')
  const [requestInfo, setRequestInfo] = useState(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [postcode, setPostcode] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    setDocumentTitle('Customer Details | A.S.S')
  }, [])

  useEffect(() => {
    async function load() {
      setStatus('loading')
      setError('')
      try {
        const out = await apiGet(`/api/customer-detail-requests/${encodeURIComponent(token)}`)
        setRequestInfo(out.request || null)
        if (out.request?.completed) setStatus('done')
        else setStatus('ready')
      } catch (err) {
        setStatus('error')
        setError(err.message || 'Unable to load this request.')
      }
    }
    if (token) load()
  }, [token])

  async function onSubmit(e) {
    e.preventDefault()
    setStatus('saving')
    setError('')
    try {
      const out = await apiPost(`/api/customer-detail-requests/${encodeURIComponent(token)}/submit`, {
        email,
        postcode,
        address,
      })
      if (out?.ok) setStatus('done')
    } catch (err) {
      setStatus('ready')
      setError(err.message || 'Submission failed.')
    }
  }

  return (
    <div className="loginPage">
      <div className="cardBox loginCard">
        <h2 className="cardTitle">Customer details update</h2>
        <p className="fieldHint">Please provide your contact details for your booking/quote.</p>
        {status === 'loading' ? <div className="emptyState">Loading…</div> : null}
        {status === 'error' ? <div className="fieldError">{error}</div> : null}
        {status === 'done' ? (
          <div className="emptyState">Thank you. Your details were submitted successfully.</div>
        ) : null}
        {status === 'ready' || status === 'saving' ? (
          <form onSubmit={onSubmit} className="settingsGrid" style={{ marginTop: 12 }}>
            {requestInfo?.customer_name ? (
              <div className="fieldHint">For: {requestInfo.customer_name}</div>
            ) : null}
            <label className="field" style={{ gridColumn: 'span 12' }}>
              <span className="fieldLabel">Email</span>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </label>
            <label className="field" style={{ gridColumn: 'span 12' }}>
              <span className="fieldLabel">Postcode</span>
              <input
                className="input"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                placeholder="AB12 3CD"
              />
            </label>
            <label className="field" style={{ gridColumn: 'span 12' }}>
              <span className="fieldLabel">Address</span>
              <textarea
                className="textarea"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House number, street, town"
              />
            </label>
            {error ? <div className="fieldError">{error}</div> : null}
            <div className="settingsActions">
              <button className="primaryButton" type="submit" disabled={status === 'saving'}>
                {status === 'saving' ? 'Submitting…' : 'Submit details'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  )
}

