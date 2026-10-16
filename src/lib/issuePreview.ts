import type { Payload } from 'payload'
import type { PublicationIssue } from '@/payload-types'
import { renderIssueEmailHtml } from '@/lib/issueEmail'
import { adSlotCount, getActiveAdsForPublication } from '@/lib/publicationAds'
import { newsletterMessageHtml } from '@/lib/ses/messageHtml'

/** Resolve only renderable fields. Preview never saves, sends, or records impressions. */
export async function previewIssue(payload: Payload, data: Partial<PublicationIssue>) {
  const idOf = (value: unknown): number => {
    const id = typeof value === 'object' && value ? (value as { id?: unknown }).id : value
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)
      throw new Error('Select a publication and valid content references.')
    return Number(id)
  }
  if (!['excerpt-list', 'pdf-report', 'custom-html'].includes(data.format || ''))
    throw new Error('Choose an issue format first.')
  const publication = await payload.findByID({
    collection: 'publications',
    id: idOf(data.publication),
    depth: 0,
  })
  const issue = {
    title: data.title || 'Untitled issue',
    format: data.format,
    intro: data.intro,
    summary: data.summary,
    body: data.body,
    email: { subject: data.email?.subject, previewText: data.email?.previewText },
    sections: [],
  } as unknown as PublicationIssue
  if ((data.sections?.length || 0) > 100) throw new Error('Too many sections to preview.')
  let itemCount = 0
  if (data.format === 'excerpt-list') {
    for (const section of data.sections || []) {
      itemCount += section.items?.length || 0
      if (itemCount > 1000) throw new Error('Preview supports up to 1,000 items.')
      const items = []
      for (const item of section.items || []) {
        if (!['articles', 'bills', 'trademarks'].includes(item.relationTo))
          throw new Error('Invalid content type.')
        const value = await payload.findByID({
          collection: item.relationTo,
          id: idOf(item.value),
          depth: 0,
          draft: true,
        })
        items.push({ relationTo: item.relationTo, value })
      }
      issue.sections!.push({
        heading: section.heading || '',
        items: items as NonNullable<NonNullable<PublicationIssue['sections']>[number]['items']>,
      })
    }
  }
  if (data.format === 'pdf-report' && data.file)
    issue.file = await payload.findByID({
      collection: 'guide-files',
      id: idOf(data.file),
      depth: 0,
    })
  const ads = await getActiveAdsForPublication(
    payload,
    publication.id,
    adSlotCount(data.format === 'pdf-report' ? 10 : itemCount),
  )
  // Disable live ad tracking endpoints so preview clicks cannot inflate metrics.
  let html = newsletterMessageHtml(renderIssueEmailHtml(issue, publication, ads), '#', '#')
  for (const ad of ads)
    html = html.replaceAll(
      `/api/ads/${ad.id}/click`,
      `/api/publication-issues/preview/disabled-link`,
    )
  // No scripts, forms, live tracking links, or navigation inside the preview frame.
  html = html.replace(
    /<head>/i,
    "<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'\">",
  )
  const file = issue.file && typeof issue.file === 'object' ? issue.file : null
  // Only our protected file handler is eligible for an embedded PDF, never a supplied URL.
  const pdfUrl = file?.filename
    ? `/api/publication-files/file/${encodeURIComponent(file.filename)}`
    : null
  return {
    html,
    subject: issue.email?.subject || issue.title,
    previewText: issue.email?.previewText || '',
    pdfUrl,
  }
}
