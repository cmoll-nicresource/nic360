'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useCallback, useEffect, useState } from 'react'

type Row = { id: number; kind: string; subject: string; status: string; createdAt: string }

const STATUS_TEXT: Record<string, string> = {
  sent: 'handed to mail service',
  delivered: 'delivered',
  bounced: 'bounced',
  complained: 'complaint',
  failed: 'failed to send',
}

/**
 * On a user's edit screen: what account email we sent them and what happened to
 * it, plus a way to get them a password link without emailing it.
 */
export function AccountEmailHelp() {
  const { id, savedDocumentData } = useDocumentInfo()
  const email = (savedDocumentData as { email?: string } | undefined)?.email
  const [rows, setRows] = useState<Row[] | null>(null)
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!email) return
    const controller = new AbortController()
    const query = new URLSearchParams({
      'where[recipient][equals]': email.toLowerCase(),
      sort: '-createdAt',
      limit: '5',
      depth: '0',
    })
    fetch(`/api/account-emails?${query}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { docs: Row[] }) => setRows(data.docs))
      .catch(() => {
        if (!controller.signal.aborted) setRows([])
      })
    return () => controller.abort()
  }, [email])

  const makeLink = useCallback(async () => {
    setBusy(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/account-emails/fresh-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: Number(id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create a link.')
      setLink(data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create a link.')
    } finally {
      setBusy(false)
    }
  }, [id])

  if (!id || !email) return null

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setMessage('Copied.')
    } catch {
      setMessage('Select the link and copy it.')
    }
  }

  return (
    <div style={{ marginBottom: 24, padding: '12px 16px', border: '1px solid var(--theme-elevation-150)', borderRadius: 2 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.2, fontWeight: 700, opacity: 0.7 }}>ACCOUNT EMAIL</div>
      {rows === null ? (
        <div style={{ fontSize: 13, marginTop: 4 }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 13, marginTop: 4 }}>No account email has been recorded for this address.</div>
      ) : (
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {rows.map((row) => (
            <li key={row.id}>
              <a href={`/admin/collections/account-emails/${row.id}`}>{row.subject}</a> ·{' '}
              {new Date(row.createdAt).toLocaleString()} · <strong>{STATUS_TEXT[row.status] ?? row.status}</strong>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginTop: 10 }}>
        {link ? (
          <>
            <input
              readOnly
              value={link.url}
              onFocus={(event) => event.currentTarget.select()}
              style={{ width: '100%', fontSize: 12 }}
              aria-label="Password link"
            />
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Works until {new Date(link.expiresAt).toLocaleTimeString()} and replaces any earlier link. Using it also confirms
              this email address, so send it only to the person it belongs to.{' '}
              <button type="button" onClick={copy}>
                Copy link
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={makeLink} disabled={busy}>
            {busy ? 'Creating…' : 'Create a password link to send another way'}
          </button>
        )}
        {message ? <div style={{ fontSize: 12, marginTop: 4 }}>{message}</div> : null}
      </div>
    </div>
  )
}
