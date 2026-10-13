import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { runTmogImportJob } from '@/lib/tmog/importJob'

/** Manually triggers the real USPTO TMOG import — same job the Friday cron runs, optionally for one specific issue date (YYYYMMDD). */
export async function POST(request: Request) {
  try {
    const { payload } = await requireStaff('gatekeeper')
    const body = await request.json().catch(() => ({}))
    const issueDate = typeof body?.issueDate === 'string' && body.issueDate.trim() ? body.issueDate.trim() : undefined

    const result = await runTmogImportJob(payload, issueDate)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'USPTO import failed.' }, { status: 500 })
  }
}
