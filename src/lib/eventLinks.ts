import type { Where } from 'payload'

/**
 * Event pages live at `/events/<slug>` (`/events/gtnf-2027`). The numeric id
 * keeps working everywhere, so links in old emails, Stripe return addresses
 * and bookmarks still arrive; the event page sends those on to the slug.
 */

const MAX_SLUG_LENGTH = 80

/** "GTNF 2027" → "gtnf-2027". Never empty and never all digits, so a slug can't be mistaken for an id. */
export function slugifyEventName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '')
  if (!slug) return 'event'
  return /^\d+$/.test(slug) ? `event-${slug}` : slug
}

/** True when the address segment is a record id, not a slug. */
export function isEventId(param: string): boolean {
  return /^\d+$/.test(param)
}

/** The query that finds an event from either form of its address. */
export function eventWhere(param: string): Where {
  return isEventId(param) ? { id: { equals: Number(param) } } : { slug: { equals: param } }
}

/** The public path of an event page, or of a page beneath it ("livestream"). */
export function eventPath(
  event: { id: number | string; slug?: string | null },
  subPage?: string,
): string {
  const base = `/events/${event.slug || event.id}`
  return subPage ? `${base}/${subPage}` : base
}
