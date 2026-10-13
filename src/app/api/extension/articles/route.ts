import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { extensionCorsHeaders, extensionOptionsResponse } from '@/lib/extensionCors'
import { lexicalFromText } from '@/lib/lexical'

type ClipBody = {
  title?: string
  excerptText?: string
  sourceUrl?: string
  sourceDomain?: string
  sourceDate?: string
}

export async function OPTIONS(request: Request) {
  return extensionOptionsResponse(request)
}

/** Lists the most recent clips for the extension's side panel. */
export async function GET(request: Request) {
  const cors = extensionCorsHeaders(request.headers.get('origin'))

  try {
    const payload = await getPayload({ config: await config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!staffHasRole(user, 'editor')) {
      return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: cors })
    }

    const { docs } = await payload.find({
      collection: 'articles',
      where: { 'ingestion.source': { equals: 'extension' } },
      sort: '-createdAt',
      limit: 15,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })

    return NextResponse.json(
      {
        articles: docs.map((a) => ({
          id: a.id,
          title: a.title,
          sourceUrl: a.sourceUrl,
          status: a._status ?? 'published',
          createdAt: a.createdAt,
          editUrl: adminEditUrl(a.id),
        })),
      },
      { headers: cors },
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not load recent clips.' }, { status: 500, headers: cors })
  }
}

/**
 * Creates a draft Article from the Nic360 News Clipper browser extension
 * (tma-ext/). Saved as a draft because the extension can't supply the
 * required index terms (locations/sectors/products/subjects) — an editor
 * fills those in and publishes from the admin.
 */
export async function POST(request: Request) {
  const cors = extensionCorsHeaders(request.headers.get('origin'))

  try {
    const payload = await getPayload({ config: await config })
    const { user } = await payload.auth({ headers: request.headers })

    if (!staffHasRole(user, 'editor')) {
      return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: cors })
    }

    const body = (await request.json()) as ClipBody
    const title = body.title?.trim()
    const sourceUrl = body.sourceUrl?.trim()
    if (!title || !sourceUrl) {
      return NextResponse.json({ error: 'Title and source URL are required.' }, { status: 400, headers: cors })
    }

    const { docs: existing } = await payload.find({
      collection: 'articles',
      where: { sourceUrl: { equals: sourceUrl } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing[0]) {
      return NextResponse.json(
        { duplicate: true, id: existing[0].id, editUrl: adminEditUrl(existing[0].id) },
        { headers: cors },
      )
    }

    const domain = body.sourceDomain?.trim().toLowerCase().replace(/^www\./, '')
    let sourceId: number | undefined
    if (domain) {
      const { docs: sources } = await payload.find({
        collection: 'sources',
        where: { domain: { equals: domain } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      sourceId = sources[0]
        ? sources[0].id
        : (await payload.create({ collection: 'sources', data: { name: domain, domain }, overrideAccess: true })).id
    }

    const doc = await payload.create({
      collection: 'articles',
      data: {
        title,
        source: sourceId,
        sourceDate: body.sourceDate || undefined,
        sourceUrl,
        excerpt: lexicalFromText(body.excerptText?.trim() || title),
        ingestion: { source: 'extension', externalId: sourceUrl, importedAt: new Date().toISOString() },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- locations/sectors/products/subjects/primarySubject are required for publishing but intentionally left for an editor to fill in before this draft is published
      } as any,
      draft: true,
      user,
      overrideAccess: false,
    })

    return NextResponse.json({ id: doc.id, editUrl: adminEditUrl(doc.id) }, { headers: cors })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Could not save this clip.' }, { status: 500, headers: cors })
  }
}

function adminEditUrl(id: number): string {
  return `${process.env.SITE_URL ?? ''}/admin/collections/articles/${id}`
}
