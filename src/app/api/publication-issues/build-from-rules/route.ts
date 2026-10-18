import { requireStaff } from '@/lib/requireStaff'
import { buildSectionsFromRules } from '@/lib/publicationRules'
import { publicationDateWindow } from '@/lib/publicationDateWindow'

/** Build into the editor's current form. No issue is created, saved or sent. */
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const { payload, user } = await requireStaff('editor')
    const text = await request.text()
    if (text.length > 16000) return Response.json({ error: 'Build request is too large.' }, { status: 413, headers })
    const data = JSON.parse(text)
    if (!data || data.format !== 'excerpt-list') throw new Error('Choose Excerpt list to build from rules.')
    const publicationId = typeof data.publication === 'object' && data.publication ? data.publication.id : data.publication
    if (!Number.isSafeInteger(Number(publicationId)) || Number(publicationId) <= 0) throw new Error('Select a publication first.')
    if (typeof data.issueDate !== 'string') throw new Error('Choose a valid issue date first.')
    publicationDateWindow(data.issueDate, 1)
    const publication = await payload.findByID({ collection: 'publications', id: Number(publicationId), depth: 0, overrideAccess: false, user }).catch(() => null)
    if (!publication) return Response.json({ error: 'Publication not found.' }, { status: 404, headers })
    const sections = await buildSectionsFromRules(payload, publication, data.issueDate)
    return Response.json({ sections, sectionCount: sections.length, itemCount: sections.reduce((n, s) => n + s.items.length, 0) }, { headers })
  } catch (error) {
    if (error instanceof Response) return error
    return Response.json({ error: error instanceof Error ? error.message : 'Unable to build from rules.' }, { status: 400, headers })
  }
}
