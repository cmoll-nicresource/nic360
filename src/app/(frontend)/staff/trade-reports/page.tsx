import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { SiteNav } from '@/components/SiteNav'
import { TradeImportWizard } from '@/components/TradeImportWizard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Trade reports' }

export default async function TradeReportsPage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  if (!staffHasRole(user, 'editor')) {
    return (
      <>
        <SiteNav />
        <div className="page">
          <h1>Trade reports</h1>
          <p>Staff sign-in required.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteNav />
      <div className="page">
        <h1>US Tobacco Trade Barometer</h1>
        <p className="muted">
          Upload this month&apos;s two Census files (<code>Imp_MMYYYY.xls</code>, <code>Exp_MMYYYY.xls</code>) to
          load them into the trade database, refresh the US Imports/US Exports datasets, and generate the Trade
          Barometer as a draft issue (PDF, plus an editable Word draft) for you to review and send. See{' '}
          <code>trade-import-runs</code> in the admin for the log of every run.
        </p>
        <TradeImportWizard />
      </div>
    </>
  )
}
