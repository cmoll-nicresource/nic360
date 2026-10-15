import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/requireStaff'
import { buildTrademarkReportIssues } from '@/lib/trademarkReportIssues'
import { parseReportRequest } from '@/lib/tmog/reportRequest'
import { IncompleteTrademarkMonthError } from '@/lib/tmog/monthlyCoverage'

export async function POST(request: Request) {
  try {
    const { payload } = await requireStaff('gatekeeper')
    let options
    try {
      options = parseReportRequest(await request.json())
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid request.' },
        { status: 400 },
      )
    }
    const issuesCreated = await buildTrademarkReportIssues(payload, options)
    return NextResponse.json({ issuesCreated })
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof IncompleteTrademarkMonthError) {
      return NextResponse.json(
        { error: error.message, code: error.code, missingIssueDates: error.missingIssueDates },
        { status: 409 },
      )
    }
    console.error(error)
    return NextResponse.json({ error: 'Could not generate the trademark report.' }, { status: 500 })
  }
}
