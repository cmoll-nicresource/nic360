import type { Payload } from 'payload'
import sharp from 'sharp'

import { SITE_URL } from '@/lib/env'
import { lexicalFromText, lexicalToPlainText } from '@/lib/lexical'
import { getActiveAdsForPublication } from '@/lib/publicationAds'
import type { PublicationAd, SummaryStory } from '@/payload-types'
import { digestProblems, groupByHeading, type HeadingRef } from './digest'
import { renderDigestPdf, type DigestInput } from './digestPdf'

export class DigestError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

const idOf = (value: unknown) => (value && typeof value === 'object' ? (value as { id: number }).id : (value as number | null | undefined))

/** The ad's image as PNG (react-pdf embeds only PNG/JPEG), capped at 1600px wide. */
async function adImage(ad: PublicationAd): Promise<DigestInput['ad'] | string> {
  const media = ad.image && typeof ad.image === 'object' ? ad.image : null
  if (!media?.url) return `The ad "${ad.advertiser}" has no image, so the PDF has no ad.`
  try {
    const res = await fetch(new URL(media.url, SITE_URL), { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(String(res.status))
    const png = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 1600, withoutEnlargement: true }).png().toBuffer()
    const { width, height } = await sharp(png).metadata()
    if (!width || !height) throw new Error('no size')
    return { png, width, height, href: new URL(`/api/ads/${ad.id}/click`, SITE_URL).href }
  } catch {
    return `The ad image for "${ad.advertiser}" could not be loaded, so the PDF has no ad.`
  }
}

function longDate(issueDate: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(issueDate.slice(0, 10) + 'T12:00:00Z'))
}

/**
 * Builds the weekly Executive Summary PDF from the issue's saved (draft)
 * stories, stores it as a protected PDF file and attaches it to a new draft
 * of the issue. Refuses sent issues and stories without a weekly heading.
 */
export async function generateWeeklyDigest(payload: Payload, issueId: number) {
  const issue = await payload
    .findByID({ collection: 'publication-issues', id: issueId, depth: 0, draft: true, overrideAccess: true })
    .catch(() => null)
  if (!issue) throw new DigestError('Issue not found.', 404)
  if (issue.format !== 'story-digest') throw new DigestError('Only weekly story PDF issues can be generated here.')
  if (issue.email?.status === 'sending' || issue.email?.status === 'sent') throw new DigestError('This issue has already been sent; its PDF is locked.', 409)
  const publication = await payload.findByID({ collection: 'publications', id: idOf(issue.publication)!, depth: 0, overrideAccess: true })

  const ids = (issue.stories ?? []).map(idOf).filter((id): id is number => typeof id === 'number')
  const found = ids.length
    ? (await payload.find({ collection: 'summary-stories', where: { id: { in: ids } }, limit: ids.length, depth: 0, overrideAccess: true })).docs
    : []
  const byId = new Map(found.map((story) => [story.id, story]))
  const stories = ids.flatMap((id) => byId.get(id) ?? [])
  const headings: HeadingRef[] = (
    await payload.find({ collection: 'summary-headings', sort: '_order', limit: 500, depth: 0, overrideAccess: true })
  ).docs.map((h) => ({ id: h.id, title: h.title }))

  const problems = digestProblems(stories.map((s) => ({ headline: s.headline, heading: idOf(s.heading) })), headings)
  if (problems.length) throw new DigestError(problems.join(' '))

  const warnings: string[] = []
  if (stories.length < ids.length) warnings.push(`${ids.length - stories.length} deleted ${ids.length - stories.length === 1 ? 'story was' : 'stories were'} left out.`)
  const [ad] = await getActiveAdsForPublication(payload, publication.id, 1)
  let adInput: DigestInput['ad'] = null
  if (ad) {
    const result = await adImage(ad)
    if (typeof result === 'string') warnings.push(result)
    else adInput = result
  }

  const groups = groupByHeading(stories, (s: SummaryStory) => idOf(s.heading), headings).map((group) => ({
    heading: group.heading!,
    stories: group.stories.map((s) => ({
      id: s.id,
      headline: s.headline,
      bodyHtml: s.bodyHtml ?? '',
      sources: (s.sources ?? []).map((source) => ({ name: source.name, url: source.url ?? null })),
      url: s.wordpress?.url ?? null,
    })),
  }))
  const day = issue.issueDate.slice(0, 10)
  const { pdf, pages } = await renderDigestPdf({ title: publication.title, dateLabel: longDate(issue.issueDate), groups, ad: adInput })

  const file = await payload.create({
    collection: 'guide-files',
    data: {},
    overrideAccess: true,
    file: { data: pdf, mimetype: 'application/pdf', name: `${publication.slug}-${day}-${Date.now()}.pdf`, size: pdf.length },
  })
  const summary = lexicalToPlainText(issue.summary).trim()
    ? issue.summary
    : lexicalFromText(`This week: ${stories.length} ${stories.length === 1 ? 'story' : 'stories'} under ${groups.length} ${groups.length === 1 ? 'heading' : 'headings'}. Download the full PDF below.`)
  try {
    await payload.update({
      collection: 'publication-issues',
      id: issue.id,
      data: { file: file.id, summary },
      draft: true,
      depth: 0,
      overrideAccess: true,
    })
  } catch (error) {
    await payload.delete({ collection: 'guide-files', id: file.id, overrideAccess: true }).catch(() => undefined)
    throw error
  }
  return {
    fileId: file.id,
    pages: Math.max(0, ...pages.values()),
    storyCount: stories.length,
    headingCount: groups.length,
    adIncluded: !!adInput,
    warnings,
  }
}
