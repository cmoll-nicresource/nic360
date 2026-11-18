import type { Payload, PayloadRequest } from 'payload'

import type { SummaryStory } from '@/payload-types'
import { copyPost, refreshedHeadline } from './tobaccoReporter'
import { downloadImage, getTobaccoReporterPost } from './tobaccoReporterClient'

async function copyImage(payload: Payload, image: { url: string; alt: string }, headline: string, req?: PayloadRequest) {
  const file = await downloadImage(image.url)
  if (!file) return null
  const doc = await payload.create({
    collection: 'media',
    data: { alt: image.alt || headline },
    file: { data: file.data, mimetype: file.mimetype, name: file.name, size: file.data.length },
    overrideAccess: true,
    req,
  })
  return doc.id
}

/**
 * Copies a Tobacco Reporter post into an Executive Summary story, or returns
 * the existing story for that post. With `refresh`, re-copies the text,
 * sources and image of an existing story, keeping its weekly heading and any
 * headline the editor changed.
 */
export async function importTobaccoReporterStory(
  payload: Payload,
  postId: number,
  { refresh = false, req }: { refresh?: boolean; req?: PayloadRequest } = {},
): Promise<{ story: SummaryStory; created: boolean; refreshed: boolean }> {
  const existing = (
    await payload.find({
      collection: 'summary-stories',
      where: { 'wordpress.postId': { equals: postId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  ).docs[0]
  if (existing && !refresh) return { story: existing, created: false, refreshed: false }

  const copied = copyPost(await getTobaccoReporterPost(postId))
  const sameImage = existing && existing.wordpress?.imageUrl === (copied.image?.url ?? null) && existing.image
  const image = copied.image
    ? sameImage
      ? existing.image
      : await copyImage(payload, copied.image, copied.headline, req)
    : null
  const data = {
    headline: existing ? refreshedHeadline({ headline: existing.headline, trHeadline: existing.wordpress?.headline }, copied.headline) : copied.headline,
    bodyHtml: copied.bodyHtml,
    sources: copied.sources,
    image: image && typeof image === 'object' ? image.id : image,
    publishedAt: copied.publishedAt,
    wordpress: {
      postId: copied.postId,
      url: copied.url,
      headline: copied.headline,
      author: copied.author,
      imageUrl: copied.image?.url ?? null,
      modifiedAt: copied.modifiedAt,
      copiedAt: new Date().toISOString(),
    },
  }
  if (existing) {
    const story = await payload.update({ collection: 'summary-stories', id: existing.id, data, depth: 0, overrideAccess: true, req })
    return { story, created: false, refreshed: true }
  }
  try {
    const story = await payload.create({ collection: 'summary-stories', data, depth: 0, overrideAccess: true, req })
    return { story, created: true, refreshed: false }
  } catch (error) {
    // Two editors adding the same post at once: the unique post id lets one win; return that copy.
    const winner = (
      await payload.find({ collection: 'summary-stories', where: { 'wordpress.postId': { equals: postId } }, limit: 1, depth: 0, overrideAccess: true })
    ).docs[0]
    if (winner) return { story: winner, created: false, refreshed: false }
    throw error
  }
}
