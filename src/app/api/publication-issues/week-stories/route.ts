import { NextResponse } from 'next/server'
import type { Where } from 'payload'

import { requireStaff } from '@/lib/requireStaff'
import { collectWeekStoryIds, weekRange } from '@/lib/summaryStories/digest'

/**
 * Stories from the published Daily Executive Summaries (story-list issues)
 * dated in the seven days ending on `issueDate`, for the weekly organizer.
 */
export async function GET(request: Request) {
  try {
    const { payload } = await requireStaff('editor')
    const issueDate = new URL(request.url).searchParams.get('issueDate') || ''
    let range: ReturnType<typeof weekRange>
    try {
      range = weekRange(issueDate)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid issue date.' }, { status: 400 })
    }
    const inWeek: { and: Where[] } = {
      and: [
        { format: { equals: 'story-list' } },
        { issueDate: { greater_than_equal: range.from } },
        { issueDate: { less_than: range.to } },
      ],
    }
    const [published, drafts] = await Promise.all([
      payload.find({
        collection: 'publication-issues',
        where: { and: [...inWeek.and, { _status: { equals: 'published' } }] },
        sort: 'issueDate',
        limit: 50,
        depth: 0,
        overrideAccess: true,
        select: { title: true, issueDate: true, stories: true },
      }),
      payload.count({
        collection: 'publication-issues',
        where: { and: [...inWeek.and, { _status: { not_equals: 'published' } }] },
        overrideAccess: true,
      }),
    ])
    return NextResponse.json(
      {
        range,
        ids: collectWeekStoryIds(published.docs),
        issues: published.docs.map((issue) => ({ id: issue.id, title: issue.title, issueDate: issue.issueDate, count: issue.stories?.length ?? 0 })),
        drafts: drafts.totalDocs,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof Response) return error
    console.error(error)
    return NextResponse.json({ error: 'Unable to collect this week’s stories.' }, { status: 500 })
  }
}
