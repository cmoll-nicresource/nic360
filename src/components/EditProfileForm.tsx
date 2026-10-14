'use client'

import React, { useState } from 'react'

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

type Profile = {
  firstName: string
  lastName: string
  email: string
  department: string | null
  businessSector: string | null
}

export function EditProfileForm({ userId, profile }: { userId: number; profile: Profile }) {
  const [editing, setEditing] = useState(false)
  const [department, setDepartment] = useState(profile.department ?? '')
  const [businessSector, setBusinessSector] = useState(profile.businessSector ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ department: department || null, businessSector: businessSector || null }),
      })
      if (!res.ok) throw new Error('Failed to save.')
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              <td>
                {profile.firstName} {profile.lastName}
              </td>
            </tr>
            <tr>
              <th>Email</th>
              <td>{profile.email}</td>
            </tr>
            <tr>
              <th>Department</th>
              <td>{department || <span className="muted">—</span>}</td>
            </tr>
            <tr>
              <th>Business sector</th>
              <td>
                {BUSINESS_SECTORS.find((s) => s.value === businessSector)?.label || <span className="muted">—</span>}
              </td>
            </tr>
          </tbody>
        </table>
        <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary" style={{ marginTop: 12 }}>
          Edit profile
        </button>
      </>
    )
  }

  return (
    <form onSubmit={handleSave}>
      <div className="field">
        <label>Department</label>
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} />
      </div>
      <div className="field">
        <label>Business sector</label>
        <select value={businessSector} onChange={(e) => setBusinessSector(e.target.value)}>
          <option value="">—</option>
          {BUSINESS_SECTORS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p style={{ color: '#9a3434' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  )
}
