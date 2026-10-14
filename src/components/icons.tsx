import React from 'react'

export type IconProps = { className?: string }

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function ArticlesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

export function BillsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v2M5 7l7-4 7 4M4 10h16M5 10v8M19 10v8M3 21h18" />
      <path d="M8 13v3M12 13v3M16 13v3" />
    </svg>
  )
}

export function TrademarksIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h2.2c1 0 1.8.6 1.8 1.6S12.2 12 11.2 12H9v-3zM9 12v3M11.5 12 13 15M15 9v6l2-3 2 3V9" />
    </svg>
  )
}

export function GuidesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 23z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 1 2.5 2" />
    </svg>
  )
}

export function PublicationsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 6.5 8 6 8-6" />
    </svg>
  )
}

export function DataIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
    </svg>
  )
}

export function EventsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 8a2 2 0 1 0 0 4M19 8a2 2 0 1 1 0 4" />
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 5v14" strokeDasharray="2.5 2.5" />
    </svg>
  )
}

export function PolicyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v2M5 7l7-4 7 4M4 10h16M5 10v8M19 10v8M3 21h18" />
    </svg>
  )
}

export function MarketsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" />
    </svg>
  )
}

export function TradeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="M3 7.5V16l9 4.5V12M21 7.5V16l-9 4.5" />
    </svg>
  )
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v11m0 0 5-5m-5 5-5-5M4 19h16" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
