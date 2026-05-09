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

  if (status === 'loading') return <div className="documentPage"><div className="emptyState">Loading job sheet…</div></div>
  if (status === 'error') return <div className="documentPage"><div className="notice bad">{error}</div></div>
  if (!job) return <div className="documentPage"><div className="emptyState">Job not found.</div></div>

  return (
    <div className="documentPage">
      <header className="documentHeader noPrint">
        <div className="documentHeaderLeft">
          {onBack && (
            <button type="button" className="documentBackButton" onClick={onBack} title="Back to Job" aria-label="Back to Job">
              ←
            </button>
          )}
          <div>
            <h1 className="documentTitle">Job Sheet</h1>
            <p className="documentSubtitle">Technician layout (A4 print-friendly)</p>
          </div>
        </div>
        <div className="documentHeaderActions">
          <button
            type="button"
            className="primaryButton"
            onClick={() => window.print()}
          >
            🖨 Print Job Sheet
          </button>
        </div>
      </header>

      <div className="documentCardContainer">
        <div className="documentCard">
          <div className="documentCardContent">
            {renderedHtml ? (
              <div className="jobSheetContent" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            ) : (
              <div className="emptyState">No job sheet template available. Set one up in Settings → Templates.</div>
            )}
          </div>
        </div>
      </div>

      <div className="documentHint noPrint">
        <p>💡 Use browser <strong>Print → Save as PDF</strong> to generate a job sheet document.</p>
      </div>
    </div>
  )
}
