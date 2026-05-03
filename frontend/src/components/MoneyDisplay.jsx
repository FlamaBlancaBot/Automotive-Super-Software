export default function MoneyDisplay({ value }) {
  const n = Number(value || 0)
  const safe = Number.isFinite(n) ? n : 0
  return <span className="mono">£{safe.toFixed(2)}</span>
}

