import { useEffect, useMemo, useState } from 'react'
import { apiGet } from '../api/http'
import { setDocumentTitle } from '../utils/title'
import RegPlate from '../components/RegPlate'
import { partsOrderTone } from '../utils/statusChips'

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('en-GB')
}

export default function JobSheetDetail({ jobId, onBack }) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [job, setJob] = useState(null)
  const [partsOrders, setPartsOrders] = useState([])
  const [latestQuote, setLatestQuote] = useState(null)

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
        setLatestQuote(data.quotes && data.quotes.length ? data.quotes[0] : null)
        setStatus('ready')
      } catch (err) {
        setStatus('error')
        setError(err.message || 'Failed to load job sheet.')
      }
    }
    load()
  }, [jobId])

  const partsRequired = useMemo(
    () => (partsOrders || []).filter((p) => String(p.status || '').toLowerCase() !== 'cancelled'),
    [partsOrders],
  )

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
        <div className="cardTop">
          <h3 className="cardTitle">AUTOSS</h3>
          <div className="fieldHint">Use browser Print → Save as PDF.</div>
        </div>
        <div className="fieldGrid" style={{ marginTop: 8 }}>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">REG</div>
            <RegPlate registration={job.vehicle_registration} />
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Vehicle</div>
            <div>{job.vehicle_make || '—'} {job.vehicle_model || ''}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 4' }}>
            <div className="fieldLabel">Job</div>
            <div>#{job.id} · {job.title || job.service_template_name}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Booking date/time</div>
            <div>{formatDateTime(job.booked_start)}</div>
          </div>
          <div className="field" style={{ gridColumn: 'span 6' }}>
            <div className="fieldLabel">Quote</div>
            <div>{latestQuote ? `${latestQuote.quote_number} (${latestQuote.status})` : 'No quote yet'}</div>
          </div>
        </div>
      </div>

      <div className="cardBox printCard" style={{ marginTop: 8 }}>
        <div className="cardTop"><h3 className="cardTitle">Customer complaint / what customer said</h3></div>
        <div className="printBox">{job.notes_customer_words || '—'}</div>
      </div>

      <div className="cardBox printCard" style={{ marginTop: 8 }}>
        <div className="cardTop"><h3 className="cardTitle">Internal office notes</h3></div>
        <div className="printBox">{job.notes_internal || '—'}</div>
      </div>

      <div className="cardBox printCard" style={{ marginTop: 8 }}>
        <div className="cardTop"><h3 className="cardTitle">Tasks / checklist</h3></div>
        <div className="printBox">☐ Pre-checks complete{'\n'}☐ Work completed as requested{'\n'}☐ Test driven{'\n'}☐ Ready to call customer</div>
      </div>

      <div className="cardBox printCard" style={{ marginTop: 8 }}>
        <div className="cardTop"><h3 className="cardTitle">Parts ordered / required</h3></div>
        {partsRequired.length ? (
          <div className="quoteTableWrap" style={{ marginTop: 8 }}>
            <table className="quoteTable">
              <thead><tr><th>Part</th><th>Supplier</th><th>Status</th><th>ETA</th><th>Fitted</th></tr></thead>
              <tbody>
                {partsRequired.map((po) => (
                  <tr key={po.id}>
                    <td>{po.part_name || po.description || '—'}</td>
                    <td>{po.supplier_name || '—'}</td>
                    <td><span className={`statusChip ${partsOrderTone(po.status)}`}>{po.status}</span></td>
                    <td>{po.eta_text || formatDateTime(po.expected_at || po.eta_datetime)}</td>
                    <td>☐</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState" style={{ marginTop: 8 }}>No parts listed.</div>
        )}
      </div>

      <div className="cardBox printCard" style={{ marginTop: 8 }}>
        <div className="cardTop"><h3 className="cardTitle">Technician completion</h3></div>
        <div className="fieldGrid" style={{ marginTop: 8 }}>
          <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Technician name</div><div className="printBox">{job.technician_name || '_________________'}</div></div>
          <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Mileage in</div><div className="printBox">{job.mileage_in || '________'}</div></div>
          <div className="field" style={{ gridColumn: 'span 4' }}><div className="fieldLabel">Mileage out</div><div className="printBox">{job.mileage_out || '________'}</div></div>
          <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Additional parts required</div><div className="printBox">{job.extra_work_found || '—'}</div></div>
          <div className="field" style={{ gridColumn: 'span 6' }}><div className="fieldLabel">Technician notes</div><div className="printBox">{job.technician_notes || '—'}</div></div>
          <div className="field" style={{ gridColumn: 'span 12' }}><div className="fieldLabel">Signature / date</div><div className="printBox">SIGNED: ____________________   DATE: ____________________</div></div>
        </div>
      </div>
    </div>
  )
}

