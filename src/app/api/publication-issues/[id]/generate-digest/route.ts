import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { DigestError, generateWeeklyDigest } from '@/lib/summaryStories/generateDigest'

/** Generates the weekly Executive Summary PDF from the saved draft and attaches it to the issue. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')
    const issueId = Number(id)
    if (!Number.isSafeInteger(issueId) || issueId <= 0) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    return NextResponse.json(await generateWeeklyDigest(payload, issueId))
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof DigestError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error(error)
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 })
  }
}
