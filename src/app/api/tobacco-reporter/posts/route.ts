import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { plainText, stripTracking } from '@/lib/summaryStories/tobaccoReporter'
import { searchTobaccoReporterPosts, TobaccoReporterError } from '@/lib/summaryStories/tobaccoReporterClient'

/** Staff search of Tobacco Reporter posts, marking those already copied into a story. */
export async function GET(request: Request) {
  try {
    const { payload } = await requireStaff('editor')
    const params = new URL(request.url).searchParams
    const page = Math.min(Math.max(Number(params.get('page')) || 1, 1), 50)
    const { posts, total } = await searchTobaccoReporterPosts(params.get('search') || '', page)
    const ids = posts.map((post) => post.id)
    const stories = ids.length
      ? (
          await payload.find({
            collection: 'summary-stories',
            where: { 'wordpress.postId': { in: ids } },
            limit: ids.length,
            depth: 0,
            overrideAccess: true,
            select: { wordpress: true },
          })
        ).docs
      : []
    const storyByPost = new Map(stories.map((story) => [story.wordpress?.postId, story.id]))
    return NextResponse.json(
      {
        total,
        page,
        posts: posts.map((post) => ({
          id: post.id,
          headline: plainText(post.title.rendered),
          excerpt: plainText(post.excerpt?.rendered || '').slice(0, 280),
          publishedAt: post.date_gmt ? `${post.date_gmt}Z` : null,
          url: stripTracking(post.link),
          storyId: storyByPost.get(post.id) ?? null,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof Response) return error
    if (error instanceof TobaccoReporterError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error(error)
    return NextResponse.json({ error: 'Unable to search Tobacco Reporter.' }, { status: 500 })
  }
}
