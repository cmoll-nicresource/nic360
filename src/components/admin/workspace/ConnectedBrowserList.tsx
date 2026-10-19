'use client'
import { useEffect, useState } from 'react'
type Connection = { id: string; label: string; created_at: string; expires_at: string; last_used_at: string | null; revoked_at: string | null; unexpired: boolean }
export function ConnectedBrowserList() {
  const [rows, setRows] = useState<Connection[] | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState('')
  async function load() {
    const response = await fetch('/api/extension/connections', { cache: 'no-store' })
    if (!response.ok) throw new Error('Could not load connected browsers.')
    setRows((await response.json()).connections)
  }
  useEffect(() => {
    fetch('/api/extension/connections', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Could not load connected browsers.')
      setRows((await response.json()).connections)
    }).catch(e => setError(e.message))
  }, [])
  async function revoke(id: string) {
    setBusy(id); setError('')
    try {
      const response = await fetch('/api/extension/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!response.ok) throw new Error('Could not disconnect this browser.')
      await load()
    } catch (e) { setError((e as Error).message) } finally { setBusy('') }
  }
  return <div>{error && <p role="alert">{error}</p>}{!rows && !error && <p>Loading connections…</p>}
    {rows?.length === 0 && <p>No browsers connected. Open N360 News Clipper or N360 Industry Clipper options in Chrome and choose Connect to Nicotine360.</p>}
    {rows?.map(row => {
      const status = row.revoked_at ? 'Disconnected' : !row.unexpired ? 'Expired' : 'Connected'
      return <article key={row.id} className="nic-workspace__panel" style={{ padding: 24, marginBottom: 16 }}>
        <h2>{row.label} <small>· {row.id.slice(0, 8)}</small></h2><p>{status}</p>
        <p>Connected: {new Date(row.created_at).toLocaleString()}<br />Expires: {new Date(row.expires_at).toLocaleString()}<br />Last used: {row.last_used_at ? new Date(row.last_used_at).toLocaleString() : 'Not used yet'}</p>
        {status === 'Connected' && <button disabled={!!busy} onClick={() => revoke(row.id)}>{busy === row.id ? 'Disconnecting…' : 'Disconnect browser'}</button>}
      </article>
    })}</div>
}
