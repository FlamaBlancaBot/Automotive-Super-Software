export default function EmptyState({ message }) {
  return <div className="emptyState">{message || 'No data.'}</div>
}

