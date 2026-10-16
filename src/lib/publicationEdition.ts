import type { Article, Bill, Publication, PublicationIssue, Trademark } from '@/payload-types'
import { formatDate } from '@/lib/formatDate'
import { hasDistinctExcerpt, sourceLabel } from '@/lib/editorial'

export type EditionReference = NonNullable<
  NonNullable<PublicationIssue['sections']>[number]['items']
>[number]

/** Metadata shared by the delivered email, editor preview and web edition. */
export function editionItem(reference: EditionReference, publication: Publication) {
  if (!reference.value || typeof reference.value !== 'object') return null
  const value = reference.value
  const locationNames = (locations: Article['locations']) =>
    [
      ...new Set(
        (locations || []).flatMap((location) =>
          typeof location === 'object' ? [location.name] : [],
        ),
      ),
    ].join(' · ')
  const subjectName = (subject: Article['primarySubject']) =>
    subject && typeof subject === 'object' ? subject.name : ''
  const common = { id: value.id, href: `/${reference.relationTo}/${value.id}` }
  if (reference.relationTo === 'articles') {
    const article = value as Article
    const source = article.source && typeof article.source === 'object' ? article.source : null
    const sourceUrl = publicationHttpUrl(article.sourceUrl)
    return {
      ...common,
      kind: 'article' as const,
      title: article.title,
      content: hasDistinctExcerpt(article.excerpt, article.title) ? article.excerpt : null,
      location: locationNames(article.locations),
      subject: subjectName(article.primarySubject),
      date: formatDate(article.sourceDate),
      sourceUrl,
      source: source?.name
        ? sourceLabel(source.name)
        : sourceUrl
          ? sourceLabel(new URL(sourceUrl).hostname)
          : '',
      fields: [],
      actions: [],
      moreActions: false,
    }
  }
  if (reference.relationTo === 'bills') {
    const bill = value as Bill
    const title =
      bill.billNumber && !bill.title.includes(bill.billNumber)
        ? `${bill.title} (${bill.billNumber})`
        : bill.title
    const textUrl = publicationHttpUrl(bill.billUrl?.url)
    const sourceUrl = textUrl || publicationHttpUrl(bill.actionUrl)
    const fields = [
      { label: 'Committee / location', value: bill.committee },
      { label: 'Status', value: bill.statusText },
      { label: 'Latest text', value: bill.latestText, href: textUrl || common.href },
      { label: 'Latest activity', value: bill.latestActivity },
    ].filter((field) => field.value?.trim())
    const actions =
      publication.frequency === 'weekly'
        ? [...(bill.actions || [])].sort(
            (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
          )
        : []
    return {
      ...common,
      kind: 'bill' as const,
      title,
      content: bill.abstract,
      location: locationNames(bill.locations) || bill.governmentLevel || '',
      subject: subjectName(bill.primarySubject),
      date: formatDate(bill.billDate),
      source: sourceUrl ? 'Source' : '',
      sourceUrl,
      fields,
      actions: actions.slice(0, 5),
      moreActions: actions.length > 5,
    }
  }
  const trademark = value as Trademark
  return {
    ...common,
    kind: 'trademark' as const,
    title: trademark.title,
    content: null,
    location: '',
    subject: '',
    date: formatDate(trademark.publishedDate || trademark.filedDate),
    source: trademark.owner || '',
    sourceUrl: null,
    fields: [],
    actions: [],
    moreActions: false,
  }
}

/** Metadata links are absolute HTTP(S) only; editor text never becomes an executable URL. */
export function publicationHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

export function editionSections(issue: PublicationIssue) {
  return (issue.sections || []).map((section, index) => ({
    ...section,
    anchor: `edition-section-${index + 1}`,
  }))
}

export function editionWebPath(issue: PublicationIssue, publication: Publication) {
  return Number.isSafeInteger(issue.id) && issue.id > 0 && publication.slug
    ? `/publications/${encodeURIComponent(publication.slug)}/issues/${issue.id}`
    : null
}
