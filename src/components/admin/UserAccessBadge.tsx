'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import { summarizeUserAccess, type AccessTone } from '@/lib/userAccessSummary'
import type { AccessProvider } from '@/payload-types'

type ProviderInfo = Pick<AccessProvider, 'name' | 'plan' | 'status' | 'licenseExpiresAt'>

const COLORS: Record<AccessTone, { bg: string; border: string; label: string }> = {
  premium: { bg: '#e6f3ea', border: '#2e7d4f', label: 'PREMIUM' },
  base: { bg: '#e8f0fa', border: '#285888', label: 'BASE' },
  none: { bg: '#f1f1f1', border: '#8a8a8a', label: 'NON-SUBSCRIBING' },
  blocked: { bg: '#fbeee6', border: '#c4662d', label: 'NO ACCESS' },
}

/**
 * Edit-screen banner: the user's effective subscription, worked out from their
 * access provider with the same rule the site uses to gate content. Follows the
 * Access provider field live, so changing it updates the banner before saving.
 */
export function UserAccessBadge() {
  const rawProvider = useFormFields(([fields]) => fields.accessProvider?.value)
  const status = useFormFields(([fields]) => fields.status?.value)
  const { savedDocumentData } = useDocumentInfo()
  const providerId =
    rawProvider && typeof rawProvider === 'object'
      ? (rawProvider as { id?: number | string }).id
      : (rawProvider as number | string | null | undefined)

  const [loaded, setLoaded] = useState<{ id: string; provider: ProviderInfo | null } | null>(null)

  useEffect(() => {
    if (!providerId) return
    const id = String(providerId)
    const controller = new AbortController()
    fetch(`/api/access-providers/${id}?depth=0`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: ProviderInfo) => setLoaded({ id, provider: data }))
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error(err)
          setLoaded({ id, provider: null })
        }
      })
    return () => controller.abort()
  }, [providerId])

  const current = providerId && loaded?.id === String(providerId) ? loaded : null

  const verified = (savedDocumentData as { _verified?: boolean } | undefined)?._verified

  if (providerId && !current) return <div style={{ marginBottom: 24, opacity: 0.7 }}>Checking subscription…</div>
  if (providerId && !current?.provider) return <div style={{ marginBottom: 24, opacity: 0.7 }}>Could not load the access provider.</div>

  const summary = summarizeUserAccess({
    provider: current?.provider ?? null,
    suspended: status === 'suspended',
    verified,
  })
  const color = COLORS[summary.tone]

  return (
    <div
      role="status"
      style={{
        marginBottom: 24,
        padding: '12px 16px',
        background: color.bg,
        borderLeft: `4px solid ${color.border}`,
        color: '#253547',
        borderRadius: 2,
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 1.2, fontWeight: 700, color: color.border }}>{color.label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, margin: '2px 0' }}>{summary.headline}</div>
      <div style={{ fontSize: 13 }}>{summary.detail}</div>
    </div>
  )
}
