export default function StatusChip({ label, tone = '' }) {
  return <span className={`statusChip ${tone}`}>{label || '—'}</span>
}

