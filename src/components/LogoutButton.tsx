'use client'

import React, { useState } from 'react'

export function LogoutButton({ collection }: { collection: 'users' | 'staff' }) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    await fetch(`/api/${collection}/logout`, { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy} className="nav-logout-btn">
      Log out
    </button>
  )
}
