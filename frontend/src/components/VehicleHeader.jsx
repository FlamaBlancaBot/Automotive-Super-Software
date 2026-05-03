import { useMemo, useState } from 'react'
import RegPlate from './RegPlate'

function toBrandFile(make) {
  return String(make || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
}

function makeInitials(make) {
  const parts = String(make || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export default function VehicleHeader({
  reg,
  make,
  model,
  subtitle,
  reference,
  small = false,
}) {
  const [logoError, setLogoError] = useState(false)
  const brandFile = useMemo(() => toBrandFile(make), [make])
  const logoSrc = `/media/car-brands/${brandFile}.png`
  const initials = makeInitials(make)

  return (
    <div className={`vehicleHeader ${small ? 'small' : ''}`}>
      <RegPlate reg={reg} small={small} />
      <div className="vehicleHeaderMeta">
        <div className="vehicleHeaderTop">
          {!logoError && brandFile ? (
            <img
              className="brandBadgeImg"
              src={logoSrc}
              alt=""
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="brandBadgeFallback" aria-hidden="true">
              {initials}
            </span>
          )}
          <div className="vehicleMainText">
            <div className="vehicleTitle">
              {String(make || '').trim() || 'MAKE'} {String(model || '').trim() || 'MODEL'}
            </div>
            {subtitle ? <div className="vehicleSubtitle">{subtitle}</div> : null}
          </div>
        </div>
        {reference ? <div className="vehicleRef">{reference}</div> : null}
      </div>
    </div>
  )
}

