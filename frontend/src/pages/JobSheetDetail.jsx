import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../api/http'
import { setDocumentTitle } from '../utils/title'

export default function JobSheetDetail({ jobId, onBack }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [job, setJob] = useState(null)
  const [partsOrders, setPartsOrders] = useState([])
  const [renderedHtml, setRenderedHtml] = useState('')

  useEffect(() => {
    setDocumentTitle('Job Sheet')
  }, [])

  useEffect(() => {
    async function load() {
      setStatus('loading')
      setError('')
      try {
        const data = await apiGet(`/api/jobs/${jobId}`)
        setJob(data.job || null)
        setPartsOrders(data.parts_orders || [])
        const rendered = await apiPost('/api/templates/job_sheet/render', { job_id: jobId })
        setRenderedHtml(rendered.rendered_html || '')
        setStatus('ready')
      } catch (err) {
        setStatus('error')
        setError(err.message || 'Failed to load job sheet.')
      }
    }
    load()
  }, [jobId])

  if (status === 'loading') return <div className="emptyState">Loading…</div>
  if (status === 'error') return <div className="notice bad">{error}</div>
  if (!job) return <div className="emptyState">Job not found.</div>

  return (
    <div className="jobSheet a4JobSheet">
      <header className="pageHeader noPrint">
        <div>
          <h2 className="pageTitle">Job Sheet</h2>
          <p className="pageSubtitle">Technician layout (A4 print-friendly).</p>
        </div>
        <div className="pageHeaderActions">
          <button type="button" className="secondaryButton" onClick={onBack}>Back</button>
          <button type="button" className="primaryButton" onClick={() => window.print()}>Print job sheet</button>
        </div>
      </header>

      <div className="cardBox printCard">
        <div className="cardTop"><h3 className="cardTitle">Generated job sheet</h3><div className="fieldHint">Use browser Print → Save as PDF</div></div>
        <div className="printDocument" style={{ marginTop: 10 }} dangerouslySetInnerHTML={{ __html: renderedHtml || '<p>No template preview available.</p>' }} />
      </div>
    </div>
  )
}
