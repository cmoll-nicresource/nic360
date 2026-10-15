'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
export function NavDropdown({
  label,
  active,
  wide = false,
  children,
}: {
  label: string
  active?: boolean
  wide?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return (
    <div
      ref={root}
      className="nav-dropdown"
      data-open={open}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <button
        type="button"
        ref={trigger}
        className={`nav-dropdown-label${active ? ' active' : ''}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        {label}
      </button>
      {open && (
        <div
          id={id}
          className={`nav-dropdown-menu${wide ? ' wide' : ''}`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) setOpen(false)
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
