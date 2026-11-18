import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { importTobaccoReporterStory } from '@/lib/summaryStories/importStory'
import { TobaccoReporterError } from '@/lib/summaryStories/tobaccoReporterClient'

/** Re-copies a story's text, sources and image from Tobacco Reporter. Issues already sent keep their saved email HTML. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')
    const story = await payload
      .findByID({ collection: 'summary-stories', id, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!story) return NextResponse.json({ error: 'Story not found.' }, { status: 404 })
    if (!story.wordpress?.postId)
      return NextResponse.json({ error: 'This story has no Tobacco Reporter article to refresh from.' }, { status: 400 })
    const result = await importTobaccoReporterStory(payload, story.wordpress.postId, { refresh: true })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof TobaccoReporterError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error(error)
    return NextResponse.json({ error: 'Unable to refresh this story.' }, { status: 500 })
  }
}
