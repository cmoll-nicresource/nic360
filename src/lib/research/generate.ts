import { researchMonth } from './period'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import type { Research } from '@/payload-types'
import { inPayloadTransaction, transactionDb } from '@/lib/payloadTransaction'
import { lexicalFromText, lexicalToPlainText } from '@/lib/lexical'
import { renderResearchDigest } from './reportPdf'

/** Never replaces a published or sent issue. Regeneration is explicit and limited to a draft. */
export async function generateResearchDigest(payload: Payload, month: string) {
  const period = researchMonth(month)
  const articles: Research[] = []
  let page = 1
  while (true) {
    const result = await payload.find({
      collection: 'research',
      where: {
        and: [
          { _status: { equals: 'published' } },
          {
            publishedDate: {
              greater_than_equal: period.from,
              less_than: period.until,
            },
          },
        ],
      },
      sort: 'publishedDate',
      limit: 500,
      page,
      depth: 1,
      overrideAccess: true,
    })
    articles.push(...result.docs)
    if (!result.hasNextPage) break
    page++
  }
  if (!articles.length)
    throw new Error(
      'No published research articles match this month. No report was created.',
    )
  for (const article of articles)
    if (
      !article.authors?.trim() ||
      !article.journal ||
      !lexicalToPlainText(article.body)
    )
      throw new Error(
        `Complete the authors, journal and body for “${article.title}” before generating the digest.`,
      )
  const groups = new Map<string, Research[]>()
  for (const article of articles) {
    const name =
      typeof article.journal === 'object' && article.journal
        ? article.journal.name
        : ''
    if (!name)
      throw new Error('A research article references an unavailable journal.')
    groups.set(name, [...(groups.get(name) ?? []), article])
  }
  const pubs = await payload.find({
    collection: 'publications',
    where: { slug: { equals: 'monthly-research-digest' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const publication = pubs.docs[0]
  if (!publication)
    throw new Error('Configure the Monthly Research Digest publication first.')
  const title = `${publication.title} - ${period.label}`
  const generatedAt = new Date()
  const pdf = await renderResearchDigest({
    title: publication.title,
    month,
    generatedAt,
    groups: [...groups]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([journal, items]) => ({ journal, articles: items })),
  })
  let uploadId: number | undefined
  try {
    const file = await payload.create({
      collection: 'guide-files',
      data: {},
      overrideAccess: true,
      file: {
        data: pdf,
        mimetype: 'application/pdf',
        name: `monthly-research-digest-${month}-${generatedAt.getTime()}.pdf`,
        size: pdf.length,
      },
    })
    uploadId = file.id
    return await inPayloadTransaction(payload, async (req) => {
      await transactionDb(payload, await req.transactionID).execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`research-digest:${month}`}))`,
      )
      const previous = await payload.find({
        collection: 'publication-issues',
        where: { researchReportKey: { equals: month } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const existing = previous.docs[0]
      if (
        existing &&
        (existing._status !== 'draft' ||
          !['not sent', undefined, null].includes(existing.email?.status))
      )
        throw new Error(
          'This month already has a published or sent digest. It cannot be overwritten.',
        )
      const data = {
        publication: publication.id,
        title,
        issueDate: generatedAt.toISOString(),
        format: 'pdf-report' as const,
        file: file.id,
        summary: lexicalFromText(
          `${period.label}: ${articles.length} research ${articles.length === 1 ? 'article' : 'articles'} from ${groups.size} ${groups.size === 1 ? 'journal' : 'journals'}.`,
        ),
        researchReportKey: month,
        _status: 'draft' as const,
      }
      const issue = existing
        ? await payload.update({
            collection: 'publication-issues',
            id: existing.id,
            data,
            overrideAccess: true,
            req,
          })
        : await payload.create({
            collection: 'publication-issues',
            data,
            overrideAccess: true,
            req,
          })
      return {
        issueId: issue.id,
        articleCount: articles.length,
        journalCount: groups.size,
        regenerated: !!existing,
      }
    })
  } catch (error) {
    if (uploadId)
      await payload
        .delete({
          collection: 'guide-files',
          id: uploadId,
          overrideAccess: true,
        })
        .catch(() => undefined)
    throw error
  }
}
