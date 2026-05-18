import { useState } from 'react'

export default function RegistrationPlateInput({ value, onChange, placeholder, disabled, required, autoFocus }) {
  const [isFocused, setIsFocused] = useState(false)

  const handleChange = (e) => {
    const normalized = String(e.target.value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .slice(0, 9)
    onChange && onChange(normalized)
  }

  return (
    <div className="regPlateWrapper">
      <div className={`regPlate ${isFocused ? 'focused' : ''}`}>
        <div className="regPlateEU">GB</div>
        <input
          type="text"
          className="regPlateInput"
          value={value || ''}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || 'AB07 XYZ'}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          maxLength="9"
          spellCheck="false"
          autoComplete="off"
        />
      </div>
    </div>
  )
}
