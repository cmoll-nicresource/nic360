import type { Event, Media, Speaker } from '@/payload-types'
import type { Channel } from '@/config/channels'
import { calendarIsoDates, type CalendarWindow } from '@/lib/eventCalendar'
import { hasRichText, safeExternalUrl } from '@/lib/eventAgenda'
import { ticketUnitPrice } from '@/lib/eventCheckout'
import { hasArtwork } from '@/lib/editorial'
import { lexicalToPlainText } from '@/lib/lexical'
import { detectVideoSource } from '@/lib/replayVideo'

/** The optional promotional parts of an event page: who attends, highlights, practical information, key dates. */

export type AudienceStat = { value: string; label: string }

/** Headline figures ("400+ delegates"), with half-filled rows dropped. */
export function audienceStats(event: Pick<Event, 'audience'>): AudienceStat[] {
  return (event.audience?.stats ?? [])
    .map((stat) => ({ value: stat.value?.trim() ?? '', label: stat.label?.trim() ?? '' }))
    .filter((stat) => stat.value && stat.label)
}

export function hasAudience(event: Pick<Event, 'audience'>): boolean {
  return audienceStats(event).length > 0 || hasRichText(event.audience?.intro)
}

export type HighlightVideo = { embedUrl: string } | { linkUrl: string }

const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i

/**
 * Vimeo and YouTube links play on the page; any other web link is offered as
 * a link to follow, so a pasted address never frames an arbitrary site.
 */
export function highlightVideo(url: string | null | undefined): HighlightVideo | null {
  const safe = safeExternalUrl(url)
  if (!safe) return null
  const youtube = YOUTUBE_ID.exec(safe)
  if (youtube) return { embedUrl: `https://www.youtube-nocookie.com/embed/${youtube[1]}` }
  if (/(^|\.)vimeo\.com$/i.test(new URL(safe).hostname)) {
    const source = detectVideoSource(safe)
    if (source?.kind === 'vimeo') return { embedUrl: `https://player.vimeo.com/video/${source.id}` }
  }
  return { linkUrl: safe }
}

export type Testimonial = { quote: string; name: string; organisation: string }

export type EventHighlights = {
  video: HighlightVideo | null
  photos: (Media & { url: string })[]
  testimonials: Testimonial[]
}

export function eventHighlights(event: Pick<Event, 'highlights'>): EventHighlights {
  const photos = (event.highlights?.photos ?? []).filter(
    (photo): photo is Media & { url: string } =>
      typeof photo === 'object' && photo !== null && hasArtwork(photo),
  )
  const testimonials = (event.highlights?.testimonials ?? [])
    .map((item) => ({
      quote: item.quote?.trim() ?? '',
      name: item.name?.trim() ?? '',
      organisation: item.organisation?.trim() ?? '',
    }))
    .filter((item) => item.quote)
  return { video: highlightVideo(event.highlights?.videoUrl), photos, testimonials }
}

export function hasHighlights(event: Pick<Event, 'highlights'>): boolean {
  const { video, photos, testimonials } = eventHighlights(event)
  return !!video || photos.length > 0 || testimonials.length > 0
}

/** Questions that have both a question and an answer. */
export function faqEntries(event: Pick<Event, 'faq'>) {
  return (event.faq ?? []).filter((item) => item.question?.trim() && hasRichText(item.answer))
}

export type KeyDate = { label: string; date: string; passed: boolean; daysLeft: number }

const utcDay = (value: string | number | Date) => {
  const date = new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * Deadlines in date order. A deadline still counts on its own day and is
 * "passed" from the day after.
 */
export function keyDates(event: Pick<Event, 'keyDates'>, now: string | number | Date): KeyDate[] {
  const today = utcDay(now)
  return (event.keyDates ?? [])
    .filter((item) => item.label?.trim() && item.date && !Number.isNaN(Date.parse(item.date)))
    .map((item) => {
      const daysLeft = Math.round((utcDay(item.date) - today) / (24 * 60 * 60 * 1000))
      return { label: item.label.trim(), date: item.date, passed: daysLeft < 0, daysLeft }
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
}

/** "today", "tomorrow", "in 12 days"; '' once it is too far off to be worth a nudge, or passed. */
export function deadlineCountdown(daysLeft: number): string {
  if (daysLeft < 0 || daysLeft > 30) return ''
  if (daysLeft === 0) return 'today'
  if (daysLeft === 1) return 'tomorrow'
  return `in ${daysLeft} days`
}

type StructuredDataInput = {
  event: Pick<
    Event,
    'name' | 'tagline' | 'description' | 'venue' | 'ticketTypes' | 'hasLivestream'
  >
  channel: Pick<Channel, 'format'>
  /** Absolute address of the event page. */
  url: string
  siteUrl: string
  window: CalendarWindow
  imageUrl?: string | null
  speakers?: Pick<Speaker, 'name' | 'role' | 'company'>[]
  /** Leave out once the event is over: tickets are no longer on offer. */
  includeOffers?: boolean
}

/** schema.org Event data, which search engines use to show dates, venue and prices in results. */
export function eventStructuredData(input: StructuredDataInput): Record<string, unknown> {
  const { event, channel, url, window } = input
  const { start, end } = calendarIsoDates(window)
  const tickets = event.ticketTypes ?? []
  const hasVirtual =
    !!event.hasLivestream || tickets.some((t) => ticketUnitPrice(t, 'virtual', false) != null)
  const address = event.venue?.address?.trim()
  const online = channel.format === 'online' || !address
  const mode = online ? 'Online' : hasVirtual ? 'Mixed' : 'Offline'
  const place = address ? { '@type': 'Place', name: address, address } : null
  const virtual = { '@type': 'VirtualLocation', url }
  const description = (event.tagline?.trim() || lexicalToPlainText(event.description)).slice(0, 300)

  const offers = input.includeOffers
    ? tickets.flatMap((ticket) =>
        (['in-person', 'virtual'] as const).flatMap((attendance) => {
          const price = ticketUnitPrice(ticket, attendance, false)
          if (price == null) return []
          return [
            {
              '@type': 'Offer',
              name: `${ticket.name} (${attendance === 'in-person' ? 'in person' : 'virtual'})`,
              price,
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
              url,
            },
          ]
        }),
      )
    : []

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    ...(description ? { description } : {}),
    startDate: start,
    endDate: end,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: `https://schema.org/${mode}EventAttendanceMode`,
    location: mode === 'Online' ? virtual : mode === 'Mixed' ? [place, virtual] : place,
    url,
    ...(input.imageUrl ? { image: [new URL(input.imageUrl, input.siteUrl).toString()] } : {}),
    organizer: { '@type': 'Organization', name: 'Nicotine360', url: input.siteUrl },
    ...(input.speakers?.length
      ? {
          performer: input.speakers.map((speaker) => ({
            '@type': 'Person',
            name: speaker.name,
            ...(speaker.role ? { jobTitle: speaker.role } : {}),
            ...(speaker.company
              ? { worksFor: { '@type': 'Organization', name: speaker.company } }
              : {}),
          })),
        }
      : {}),
    ...(offers.length ? { offers } : {}),
  }
}

/** JSON for a script tag: "<" is escaped so text from the CMS can't close the tag. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
