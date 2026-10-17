'use client'

import React, { useState } from 'react'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!response.ok) throw new Error('Could not request a reset link. Please wait a moment and try again.')
      // Payload returns the same successful response for an unknown address.
      setSent(true)
    } catch {
      setError('Could not request a reset link. Please wait a moment and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return <p className="card" role="status">If that email matches an account, we&apos;ve sent a reset link. Check your inbox and spam folder. The link expires in one hour; use the newest email if you request another.</p>
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  )
}
