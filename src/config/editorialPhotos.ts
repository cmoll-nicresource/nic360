export const EDITORIAL_PHOTOS = {
  port: {
    file: 'container-port',
    width: 8300,
    height: 4814,
    alt: 'A container ship alongside cranes at a coastal cargo terminal.',
    position: '45% 55%',
  },
  shipping: {
    file: 'international-shipping',
    width: 7952,
    height: 4472,
    alt: 'A loaded cargo ship and gantry cranes at a port at sunset.',
    position: '60% 50%',
  },
  lansdowne: {
    file: 'lansdowne-atnf',
    width: 1920,
    height: 1080,
    alt: 'Lansdowne resort and grounds at dusk.',
    position: '60% 55%',
  },
  capitol: {
    file: 'state-capitol',
    width: 2892,
    height: 1926,
    alt: 'A domed state capitol framed by trees and a fountain.',
    position: '50% 38%',
  },
  chamber: {
    file: 'legislative-chamber',
    width: 3872,
    height: 2592,
    alt: 'An empty legislative chamber with rows of desks facing the speaker’s platform.',
    position: '50% 48%',
  },
  field: {
    file: 'tobacco-fields',
    width: 3920,
    height: 2205,
    alt: 'An aerial view of a tractor between long rows of tobacco plants.',
    position: '50% 50%',
  },
  barn: {
    file: 'tobacco-curing',
    width: 5974,
    height: 3360,
    alt: 'Harvested tobacco leaves hanging in rows to cure in a barn.',
    position: '50% 50%',
  },
  stamp: {
    file: 'trademark-stamp',
    width: 5436,
    height: 3368,
    alt: 'A close view of a stamp being applied to a document.',
    position: '50% 65%',
  },
} as const

export type EditorialPhotoKey = keyof typeof EDITORIAL_PHOTOS

/** The supplied venue photograph belongs to the upcoming ATNF, not every past forum. */
export function eventPhotoKey(event: {
  channel: string
  name: string
  venue?: { address?: string | null } | null
}): EditorialPhotoKey | null {
  return event.channel === 'atnf' &&
    (/lansdowne/i.test(event.venue?.address || '') || /^ATNF\s+2027$/i.test(event.name.trim()))
    ? 'lansdowne'
    : null
}
