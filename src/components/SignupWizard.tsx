'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import React, { useState } from 'react'

type Step = 'email' | 'code' | 'profile'

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Mx.']
const BUSINESS_SECTORS = [
  { label: 'Manufacturer/Exporter: Tobacco and Vapor Products/Services', value: 'manufacturer-exporter' },
  { label: 'Retail & Distribution', value: 'retail-distribution' },
  { label: 'Public Health', value: 'public-health' },
  { label: 'Academia', value: 'academia' },
  { label: 'Government/Regulatory', value: 'government-regulatory' },
  { label: 'Law/Consulting', value: 'law-consulting' },
  { label: 'Media', value: 'media' },
  { label: 'Other', value: 'other' },
]

function StepIndicator({ step }: { step: Step }) {
  const order: Step[] = ['email', 'code', 'profile']
  const idx = order.indexOf(step)
  const labels: Record<Step, string> = { email: '1. Email', code: '2. Verify', profile: '3. Profile' }
  return (
    <div className="wizard-steps">
      {order.map((s, i) => (
        <div key={s} className={`step ${i === idx ? 'active' : i < idx ? 'done' : ''}`}>
          {labels[s]}
        </div>
      ))}
    </div>
  )
}

export function SignupWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [matchedProvider, setMatchedProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [existingAccount, setExistingAccount] = useState(false)

  // Step 3 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [salutation, setSalutation] = useState('')
  const [department, setDepartment] = useState('')
  const [phone, setPhone] = useState('')
  const [businessSector, setBusinessSector] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleStartSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExistingAccount(false)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/signup/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.status === 'exists') setExistingAccount(true)
        throw new Error(data.error || 'Could not send a code.')
      }
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch('/api/auth/signup/verify-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not verify that code.')
      setMatchedProvider(data.matchedProvider ?? null)
      setStep('profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify that code.')
    } finally {
      setBusy(false)
    }
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/auth/signup/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          salutation: salutation || undefined,
          department: department || undefined,
          phone: phone || undefined,
          businessSector: businessSector || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          newCompanyName: matchedProvider ? undefined : newCompanyName || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not finish sign-up.')

      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!loginRes.ok) throw new Error('Account created, but sign-in failed. Try signing in manually.')

      router.push('/signup/finish')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish sign-up.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <StepIndicator step={step} />

      {step === 'email' && (
        <form onSubmit={handleStartSubmit}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}
          {existingAccount && (
            <p className="muted">
              <Link href="/account">Sign in instead →</Link>
            </p>
          )}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Sending…' : 'Send verification code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleCodeSubmit}>
          <p className="muted">We sent a 6-digit code to {email}.</p>
          <div className="field">
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              inputMode="numeric"
              maxLength={6}
            />
          </div>
          {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </form>
      )}

      {step === 'profile' && (
        <form onSubmit={handleProfileSubmit}>
          {matchedProvider ? (
            <p className="notice notice-info">
              Your email matches <strong>{matchedProvider}</strong>. You&apos;ll be linked to their
              subscription automatically.
            </p>
          ) : (
            <p className="notice notice-info">
              We couldn&apos;t match your email to a company we already work with. Tell us your
              company name below and we&apos;ll follow up about a subscription.
            </p>
          )}

          <div className="field">
            <label htmlFor="salutation">Salutation</label>
            <select id="salutation" value={salutation} onChange={(e) => setSalutation(e.target.value)}>
              <option value="">—</option>
              {SALUTATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="firstName">First name</label>
            <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="department">Department</label>
            <input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="businessSector">Business sector</label>
            <select
              id="businessSector"
              value={businessSector}
              onChange={(e) => setBusinessSector(e.target.value)}
            >
              <option value="">—</option>
              {BUSINESS_SECTORS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {!matchedProvider && (
            <div className="field">
              <label htmlFor="newCompanyName">Company name</label>
              <input
                id="newCompanyName"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Your employer"
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && <p style={{ color: '#8a2b2b' }}>{error}</p>}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}
    </div>
  )
}
