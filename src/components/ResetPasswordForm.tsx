'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import React, { useState } from 'react'

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Could not reset password.')
      router.push('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <label style={{ display: 'block', marginBottom: 8 }}>
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          style={{ display: 'block', marginTop: 4 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        Confirm password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          style={{ display: 'block', marginTop: 4 }}
        />
      </label>
      <p className="muted">Use at least 8 characters.</p>
      {error && <p role="alert" style={{ color: '#8a2b2b' }}>{error} <Link href="/forgot-password">Request a new reset link</Link>.</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Set password and sign in'}
      </button>
    </form>
  )
}
