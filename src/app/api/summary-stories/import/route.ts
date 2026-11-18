import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { importTobaccoReporterStory } from '@/lib/summaryStories/importStory'
import { findTobaccoReporterPostId, TobaccoReporterError } from '@/lib/summaryStories/tobaccoReporterClient'

/** Copies a Tobacco Reporter post (by id or pasted link) into a story, or returns the existing copy. */
export async function POST(request: Request) {
  try {
    const { payload } = await requireStaff('editor')
    const body = (await request.json().catch(() => ({}))) as { postId?: unknown; url?: unknown }
    const postId =
      typeof body.url === 'string' && body.url.trim()
        ? await findTobaccoReporterPostId(body.url)
        : Number(body.postId)
    if (!Number.isSafeInteger(postId) || postId <= 0)
      return NextResponse.json({ error: 'Choose a Tobacco Reporter article.' }, { status: 400 })
    const result = await importTobaccoReporterStory(payload, postId)
    return NextResponse.json(result, { status: result.created ? 201 : 200 })
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof TobaccoReporterError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error(error)
    return NextResponse.json({ error: 'Unable to copy that article.' }, { status: 500 })
  }
}
