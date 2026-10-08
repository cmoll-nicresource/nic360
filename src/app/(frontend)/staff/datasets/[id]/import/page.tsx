import { headers as getHeaders } from 'next/headers.js'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { ImportWizard } from '@/components/ImportWizard'

export const dynamic = 'force-dynamic'

export default async function ImportDatasetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!staffHasRole(user, 'editor')) {
    return (
      <div className="page">
        <h1>Import data</h1>
        <p>Staff sign-in required. Use the admin panel login, then reopen this link.</p>
      </div>
    )
  }

  const dataset = await payload.findByID({ collection: 'datasets', id, overrideAccess: true }).catch(() => null)
  if (!dataset) notFound()

  return (
    <div className="page">
      <h1>Import data: {dataset.title}</h1>
      <p className="muted">
        Upload a CSV, map its headers to this dataset&apos;s columns, preview, then confirm.
      </p>
      <ImportWizard datasetId={String(dataset.id)} datasetSlug={dataset.slug} />
    </div>
  )
}
