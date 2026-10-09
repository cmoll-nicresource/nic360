import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'

const LINKS = [
  { href: '/articles', label: 'Articles' },
  { href: '/bills', label: 'Bills' },
  { href: '/trademarks', label: 'Trademarks' },
  { href: '/datasets', label: 'Data' },
  { href: '/guides', label: 'Guides' },
  { href: '/publications', label: 'Publications' },
  { href: '/events', label: 'Events' },
]

/** Shared top nav for every front-end page: brand mark, section links, and auth-aware actions on the right. */
export async function SiteNav() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = !!user && 'collection' in user && user.collection === 'staff'
  const isReader = !!user && 'collection' in user && user.collection === 'users'

  return (
    <nav className="topnav">
      <Link href="/" className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Nicotine360" />
      </Link>
      <div className="nav-links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="nav-right">
        {isReader && <Link href="/dashboard">Dashboard</Link>}
        {isReader && <Link href="/account">Account</Link>}
        {isStaff && <Link href="/access-check">Access check</Link>}
        {isStaff && <Link href={payloadConfig.routes.admin}>Admin</Link>}
        {!user && <Link href="/signup" className="btn">Sign up</Link>}
      </div>
    </nav>
  )
}
