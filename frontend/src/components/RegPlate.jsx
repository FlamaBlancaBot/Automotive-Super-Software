export default function RegPlate({ reg, small = false }) {
  const text = String(reg || '').trim() || 'REG'
  return (
    <div className={`regPlate ${small ? 'small' : ''}`} aria-label={`Registration ${text}`}>
      <span className="regPlateUk" aria-hidden="true">
        UK
      </span>
      <span className="regPlateText">{text}</span>
    </div>
  )
}

