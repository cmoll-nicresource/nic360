'use client'
import { useState } from 'react'
import Link from 'next/link'
import type { ConnectRequest } from '@/lib/clipperAuth'
export function ConnectApproval({ input }: { input: ConnectRequest }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function approve() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/extension/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to connect.')
      window.location.assign(data.callback)
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }
  return <div><button onClick={approve} disabled={busy}>{busy ? 'Connecting…' : 'Connect this browser'}</button>
    <p><Link href="/admin">Cancel and return to workspace</Link></p>
    {error && <p role="alert">{error}</p>}</div>
}
