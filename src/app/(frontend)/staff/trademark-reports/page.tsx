import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { RunTrademarkReportButton } from '@/components/RunTrademarkReportButton'
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
          Pulls the USPTO feed (a fixture stands in for it), upserts trademarks by serial number,
          and drafts the Weekly US Trademark Report / Monthly US Trademark Activity issues. In
          production this runs on a schedule; here it&apos;s manual. See{' '}
          <code>trademark-import-runs</code> in the admin for the log.
        </p>
        <RunTrademarkReportButton />
      </div>
    </>
  )
}
