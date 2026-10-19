import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { staffHasRole } from '@/access/staffRoles'
import { authenticateClipper } from '@/lib/clipperAuth'
import { extensionCorsHeaders, extensionOptionsResponse } from '@/lib/extensionCors'
import { lexicalFromText } from '@/lib/lexical'
import { clipHttpUrl, clipPublishedDate } from '@/lib/extensionClip'

type ClipBody = {
  title?: string
  excerptText?: string
  sourceUrl?: string
  sourceDomain?: string
  sourceDate?: string
  socialPreview?: { description?: string; imageUrl?: string }
  locationIds?: number[]
}

export async function OPTIONS(request: Request) {
  return extensionOptionsResponse(request)
}

/** Lists the most recent clips for the extension's side panel. */
export async function GET(request: Request) {
  const cors = extensionCorsHeaders(request.headers.get('origin'))

  try {
    const payload = await getPayload({ config: await config })
    const user = await authenticateClipper(payload, request)

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
 * Creates a draft Article from the N360 News Clipper browser extension
 * (tma-ext/). Saved as a draft because the extension can't supply the
 * subject/product indexing is reviewed manually before publishing.
 */
export async function POST(request: Request) {
  const cors = extensionCorsHeaders(request.headers.get('origin'))

  try {
    const payload = await getPayload({ config: await config })
    const user = await authenticateClipper(payload, request)

    if (!staffHasRole(user, 'editor')) {
      return NextResponse.json({ error: 'Staff sign-in required.' }, { status: 401, headers: cors })
    }

    let body: ClipBody
    try { body = await request.json() } catch {
      return NextResponse.json({ error: 'Invalid clip data.' }, { status: 400, headers: cors })
    }
    if (!body || typeof body !== 'object')
      return NextResponse.json({ error: 'Invalid clip data.' }, { status: 400, headers: cors })
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 1000) : ''
    const sourceUrl = clipHttpUrl(body.sourceUrl)
    if (!title || !sourceUrl) {
      return NextResponse.json({ error: 'Title and a valid HTTP(S) source URL are required.' }, { status: 400, headers: cors })
    }
    let sourceDate: string | undefined
    try { sourceDate = clipPublishedDate(body.sourceDate) } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400, headers: cors })
    }
    const imageValue = body.socialPreview?.imageUrl
    const imageUrl = clipHttpUrl(imageValue, true)
    if (imageValue && !imageUrl)
      return NextResponse.json({ error: 'The preview image must have a valid HTTPS URL.' }, { status: 400, headers: cors })
    const description = typeof body.socialPreview?.description === 'string' ? body.socialPreview.description.trim().slice(0, 10000) : ''
    const excerptText = typeof body.excerptText === 'string' ? body.excerptText.trim().slice(0, 10000) : description
    if (body.locationIds !== undefined && (!Array.isArray(body.locationIds) || body.locationIds.length > 20 || body.locationIds.some(id => !Number.isSafeInteger(id) || id <= 0)))
      return NextResponse.json({ error: 'Choose up to 20 valid locations.' }, { status: 400, headers: cors })
    const locationIds = [...new Set(body.locationIds ?? [])]
    if (locationIds.length) {
      const found = await payload.find({ collection: 'locations', where: { id: { in: locationIds } }, limit: 20, depth: 0, user, overrideAccess: false })
      if (found.docs.length !== locationIds.length)
        return NextResponse.json({ error: 'One of the selected locations no longer exists. Refresh the location list.' }, { status: 400, headers: cors })
    }

    const { docs: existing } = await payload.find({
      collection: 'articles',
      where: { or: [{ sourceUrl: { equals: sourceUrl } }, { sourceUrl: { equals: body.sourceUrl!.trim() } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      draft: true,
    })
    if (existing[0]) {
      return NextResponse.json(
        { duplicate: true, id: existing[0].id, editUrl: adminEditUrl(existing[0].id) },
        { headers: cors },
      )
    }

    const domain = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '')
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
        sourceDate,
        sourceUrl,
        excerpt: excerptText ? lexicalFromText(excerptText) : undefined,
        socialPreview: { description: description || undefined, imageUrl },
        locations: locationIds,
        ingestion: { source: 'extension', externalId: sourceUrl, importedAt: new Date().toISOString() },
      },
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
