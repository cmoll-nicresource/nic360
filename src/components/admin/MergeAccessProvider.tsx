'use client'

import { useAuth, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProviderMergePreview } from '@/lib/mergeAccessProvider'

type Choice = { id: number; name: string }

export function MergeAccessProvider() {
  const { user } = useAuth()
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [choices, setChoices] = useState<Choice[]>([])
  const [target, setTarget] = useState<Choice | null>(null)
  const [preview, setPreview] = useState<ProviderMergePreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (modified && preview) { setPreview(null); setConfirmed(false) }
  useEffect(() => {
    if (!open || !search.trim()) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ 'where[name][like]': search.trim(), limit: '20', depth: '0', sort: 'name' })
        const res = await fetch(`/api/access-providers?${query}`, { signal: controller.signal })
        if (!res.ok) throw new Error('Unable to find providers.')
        const data = await res.json()
        setChoices(data.docs.filter((p: Choice) => p.id !== Number(id)))
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Search failed.')
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, search, id])

  if (!id || user?.collection !== 'staff' || user.role !== 'admin') return null

  async function run(action: 'preview' | 'merge') {
    if (!target || modified) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/admin/access-providers/merge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sourceId: Number(id), targetId: target.id, fingerprint: preview?.fingerprint, confirm: confirmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unable to merge.')
      if (action === 'merge') {
        router.replace(`/admin/collections/access-providers/${target.id}`)
        router.refresh()
      } else { setPreview(data.preview); setConfirmed(false) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to merge.')
      setPreview(null); setConfirmed(false)
    } finally { setBusy(false) }
  }

  const subscription = (p: ProviderMergePreview['source']) => `${p.plan} · ${p.status} · ${p.expiresAt ? `expires ${new Date(p.expiresAt).toLocaleDateString()}` : 'no expiry'}`
  const usersLabel = (count: number) => `${count} ${count === 1 ? 'user' : 'users'}`
  return <section className="nic-provider-merge" style={{ marginTop: 32, padding: 20, border: '1px solid var(--theme-elevation-200)', borderRadius: 6 }} aria-label="Merge access provider">
    <h3 style={{ marginTop: 0 }}>Consolidate this access provider</h3>
    <p>Move this provider’s users, domains and event discount codes into another provider, then remove this record.</p>
    {!open ? <button type="button" onClick={() => setOpen(true)}>Merge into another provider…</button> : <>
      {modified && <p role="status">Save or discard your changes before previewing a merge.</p>}
      <label htmlFor="provider-merge-search">Find the provider to keep</label>
      <input id="provider-merge-search" value={search} disabled={busy} placeholder="Search by company name" onChange={e => { setSearch(e.target.value); setChoices([]); setTarget(null); setPreview(null); setConfirmed(false); setError('') }} style={{ display: 'block', width: '100%', maxWidth: 520, padding: 10, margin: '8px 0' }} />
      {!!choices.length && !target && <ul>{choices.map(p => <li key={p.id}><button type="button" onClick={() => { setTarget(p); setChoices([]); setPreview(null); setConfirmed(false) }}>{p.name} (#{p.id})</button></li>)}</ul>}
      {search.trim() && !target && !choices.length && <p>Search for and select the provider you want to keep. Up to 20 matches are shown.</p>}
      {target && <p>Keep: <strong>{target.name}</strong> (#{target.id})</p>}
      {target && !preview && <button type="button" disabled={busy || modified} onClick={() => run('preview')}>{busy ? 'Loading…' : 'Preview merge'}</button>}
      {preview && !modified && <div aria-live="polite">
        <h4>Review the merge</h4>
        <div className="nic-provider-merge__comparison">
          <p><strong>Remove:</strong> {preview.source.name} (#{preview.source.id})<br />{usersLabel(preview.source.users)}<br />{subscription(preview.source)}</p>
          <p><strong>Keep:</strong> {preview.target.name} (#{preview.target.id})<br />{usersLabel(preview.target.users)} currently<br />{subscription(preview.target)}</p>
        </div>
        <p><strong>{usersLabel(preview.source.users)}</strong> and <strong>{preview.discountCodesToMove} discount codes</strong> will move. The surviving provider will have {usersLabel(preview.source.users + preview.target.users)}.</p>
        <p><strong>Domains / addresses to add:</strong> {preview.domainsToAdd.join(', ') || 'None; all are already covered.'}</p>
        <p>The surviving provider’s plan, status and expiry shown above will apply to moved users. Their passwords, verification, suspended status, publication choices and event registrations will be preserved. No emails will be sent.</p>
        <label style={{ display: 'block', margin: '16px 0' }}><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} /> I confirm these organizations should be consolidated under {preview.target.name}, using its subscription settings. Remove {preview.source.name}.</label>
        <button type="button" disabled={busy || !confirmed} onClick={() => run('merge')}>{busy ? 'Merging…' : `Merge into ${preview.target.name}`}</button>
      </div>}
      <button type="button" disabled={busy} onClick={() => { setOpen(false); setPreview(null); setConfirmed(false); setTarget(null); setSearch(''); setError('') }} style={{ marginLeft: 12 }}>Cancel</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>
}
