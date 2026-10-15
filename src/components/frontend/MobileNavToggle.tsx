'use client'
import { useState } from 'react'
import { CloseIcon, MenuIcon } from '@/components/icons'

export function MobileNavToggle() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <input
        type="checkbox"
        id="nav-toggle"
        className="nav-toggle-checkbox"
        checked={open}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className="nav-toggle-btn"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        aria-controls="primary-links"
        onClick={() => setOpen(!open)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
    </>
  )
}
