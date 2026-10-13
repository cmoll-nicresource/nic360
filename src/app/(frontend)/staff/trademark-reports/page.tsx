import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { RunTrademarkReportButton } from '@/components/RunTrademarkReportButton'
import { RunUsptoImportButton } from '@/components/RunUsptoImportButton'
import { SiteNav } from '@/components/SiteNav'

export const dynamic = 'force-dynamic'

export default async function TrademarkReportsPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!staffHasRole(user, 'gatekeeper')) {
    return (
      <>
        <SiteNav />
        <div className="page">
          <h1>Trademark reports</h1>
          <p>Gatekeeper sign-in required.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1>Trademark reports</h1>
        <p className="muted">
          The live import below pulls real class-34 filings from the USPTO Trademark Official
          Gazette, runs automatically every Friday, and drafts the Weekly US Trademark Report /
          Monthly US Trademark Activity issues from whatever it finds. See{' '}
          <code>trademark-import-runs</code> in the admin for the log of every run, scheduled or
          manual.
        </p>
        <h2>Live USPTO import</h2>
        <RunUsptoImportButton />

        <h2 style={{ marginTop: 32 }}>Fixture import (offline testing)</h2>
        <p className="muted">
          Same upsert and report-drafting logic, fed from a small local fixture instead of the
          real feed — useful for testing without network access to USPTO.
        </p>
        <RunTrademarkReportButton />
      </div>
    </>
  )
}
