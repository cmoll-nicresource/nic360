import { getPayload, type Where } from 'payload'
import config from '@/payload.config'
import { authenticateClipper } from '@/lib/clipperAuth'
import {
  extensionCorsHeaders,
  extensionOptionsResponse,
} from '@/lib/extensionCors'
import { clipHttpUrl, clipPublishedDate } from '@/lib/extensionClip'
import { normalizeDoi } from '@/lib/research/doi'
import { lexicalFromParagraphs } from '@/lib/lexical'
export const OPTIONS = extensionOptionsResponse
export async function GET(request: Request) {
  const headers = extensionCorsHeaders(request.headers.get('origin'))
  const payload = await getPayload({ config })
  if (!(await authenticateClipper(payload, request, 'research')))
    return Response.json(
      { error: 'Connect the N360 Industry News Clipper with a staff account.' },
      { status: 401, headers },
    )
  const journals = await payload.find({
    collection: 'journals',
    sort: 'name',
    limit: 0,
    pagination: false,
    depth: 0,
    select: { name: true, homepage: true },
    overrideAccess: true,
  })
  return Response.json({ journals: journals.docs }, { headers })
}
export async function POST(request: Request) {
  const headers = extensionCorsHeaders(request.headers.get('origin'))
  try {
    const payload = await getPayload({ config })
    const user = await authenticateClipper(payload, request, 'research')
    if (!user)
      return Response.json(
        { error: 'Connect the N360 Industry News Clipper with a staff account.' },
        { status: 401, headers },
      )
    const body = await request.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const sourceUrl = clipHttpUrl(body?.sourceUrl)
    if (
      !title ||
      title.length > 1000 ||
      !sourceUrl ||
      !sourceUrl.startsWith('https://') ||
      sourceUrl.length > 4096
    )
      throw new Error('Provide an article title and valid HTTPS source URL.')
    const authors = typeof body.authors === 'string' ? body.authors.trim() : ''
    const text = typeof body.body === 'string' ? body.body.trim() : ''
    if (authors.length > 20000 || text.length > 300000)
      throw new Error('This clip is too large. Shorten it before saving.')
    const publishedDate = clipPublishedDate(body.publishedDate)
    const doiLink = normalizeDoi(body.doiLink)
    const journal =
      body.journalId == null || body.journalId === ''
        ? undefined
        : Number(body.journalId)
    if (
      journal !== undefined &&
      (!Number.isSafeInteger(journal) ||
        journal < 1 ||
        !(await payload
          .findByID({ collection: 'journals', id: journal, depth: 0 })
          .catch(() => null)))
    )
      throw new Error(
        'Choose an existing journal or leave it blank for review.',
      )
    const or: Where[] = [{ sourceUrl: { equals: sourceUrl } }]
    if (doiLink) or.push({ doiKey: { equals: doiLink.toLowerCase() } })
    const duplicate = async () =>
      (
        await payload.find({
          collection: 'research',
          where: { or },
          limit: 1,
          depth: 0,
          draft: true,
          overrideAccess: true,
        })
      ).docs[0]
    const existing = await duplicate()
    const result = (id: number, duplicated: boolean) =>
      Response.json(
        {
          id,
          duplicate: duplicated,
          editUrl: `/admin/collections/research/${id}`,
          warnings: [
            !authors && 'Add authors',
            !publishedDate && 'Add published date',
            !journal && 'Select journal',
            !text && 'Add body',
            !doiLink && 'Add DOI if available',
          ].filter(Boolean),
        },
        { headers },
      )
    if (existing) return result(existing.id, true)
    try {
      const article = await payload.create({
        collection: 'research',
        draft: true,
        user,
        overrideAccess: false,
        data: {
          title,
          authors,
          publishedDate,
          doiLink,
          sourceUrl,
          journal,
          body: text ? lexicalFromParagraphs(text.split(/\n\s*\n/)) : undefined,
          ingestion: {
            source: 'extension',
            externalId: sourceUrl,
            importedAt: new Date().toISOString(),
          },
          _status: 'draft',
        },
      })
      return result(article.id, false)
    } catch (error) {
      const raced = await duplicate()
      if (raced) return result(raced.id, true)
      throw error
    }
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not create a research draft.',
      },
      { status: 400, headers },
    )
  }
}
