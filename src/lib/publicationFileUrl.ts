import type { CollectionAfterReadHook } from 'payload'

/** Keep the original storage route valid while naming publication downloads correctly. */
export function publicationFileUrl(filename: string): string {
  return `/api/publication-files/file/${encodeURIComponent(filename)}`
}

export const usePublicationFileUrl: CollectionAfterReadHook = async ({ doc, req }) => {
  if (!doc.id || !doc.filename) return doc
  // depth: 0 is essential: this lookup must not populate this same upload again.
  const reference = await req.payload.find({
    collection: 'publication-issues',
    where: { file: { equals: doc.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (reference.docs.length) return { ...doc, url: publicationFileUrl(doc.filename) }
  return doc
}
