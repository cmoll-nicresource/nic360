import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { runTrademarkReportJob } from '@/lib/trademarkReportJob'

export async function POST() {
  try {
    const { payload } = await requireStaff('gatekeeper')
    const run = await runTrademarkReportJob(payload)
    return NextResponse.json(run)
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Trademark report job failed.' }, { status: 500 })
  }
}
