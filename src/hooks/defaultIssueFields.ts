import type { CollectionBeforeValidateHook } from 'payload'
import { defaultIssueDate, publicationIssueTitle } from '@/lib/publicationIssueTitle'

export const defaultIssueFields: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data) return data
  const needsTitle =
    typeof data.title === 'string'
      ? !data.title.trim()
      : operation === 'create' || !originalDoc?.title
  const needsFormat = operation === 'create' && !data.format
  if (!needsTitle && !needsFormat) return data
  const reference = data.publication ?? originalDoc?.publication
  const id = typeof reference === 'object' ? reference?.id : reference
  if (!id) return data
  const publication = await req.payload.findByID({ collection: 'publications', id, depth: 0, req })
  if (needsFormat) data.format = publication.format
  if (needsTitle) {
    const date = data.issueDate ?? originalDoc?.issueDate ?? defaultIssueDate()
    data.issueDate = date
    data.title = publicationIssueTitle(publication.title, publication.frequency, date)
  }
  return data
}
