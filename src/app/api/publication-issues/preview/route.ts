import { requireStaff } from '@/lib/requireStaff'
import { previewIssue } from '@/lib/issuePreview'
import type { PublicationIssue } from '@/payload-types'

export async function POST(request: Request) {
  try {
    const { payload } = await requireStaff('editor')
    const text = await request.text()
    if (text.length > 2_000_000)
      return Response.json({ error: 'Preview is too large.' }, { status: 413 })
    const data = JSON.parse(text) as Partial<PublicationIssue>
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error('Invalid preview data.')
    return Response.json(await previewIssue(payload, data), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to preview this issue.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
