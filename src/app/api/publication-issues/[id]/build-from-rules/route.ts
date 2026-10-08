import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { buildSectionsFromRules } from '@/lib/publicationRules'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload } = await requireStaff('editor')

    const issue = await payload.findByID({ collection: 'publication-issues', id, depth: 0, overrideAccess: true }).catch(() => null)
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    if (issue.format !== 'excerpt-list') {
      return NextResponse.json({ error: 'Build from rules only applies to excerpt-list issues.' }, { status: 400 })
    }

    const publicationId = typeof issue.publication === 'object' ? issue.publication.id : issue.publication
    const publication = await payload
      .findByID({ collection: 'publications', id: publicationId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!publication) return NextResponse.json({ error: 'Publication not found.' }, { status: 404 })

    const sections = await buildSectionsFromRules(payload, publication)

    const updated = await payload.update({
      collection: 'publication-issues',
      id,
      data: { sections },
      overrideAccess: true,
    })

    return NextResponse.json({ sectionCount: sections.length, itemCount: sections.reduce((n, s) => n + s.items.length, 0), issue: updated })
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to build from rules.' }, { status: 500 })
  }
}
