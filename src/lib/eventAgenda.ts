import type { Event, Session, Speaker, Sponsor } from '@/payload-types'
import { lexicalToPlainText } from '@/lib/lexical'
import { clockMinutes } from '@/lib/sessionTime'

/** True when a rich text field holds something a visitor could read. */
export function hasRichText(doc: unknown): boolean {
  return lexicalToPlainText(doc).length > 0
}

export type AgendaView = 'draft' | 'sessions' | 'empty'

/**
 * Which agenda the public event page shows. Staff choose with `agendaMode`;
 * a choice that has nothing behind it falls back to whatever does exist, so
 * the page never shows an empty programme when there is one to show.
 */
export function agendaView(
  event: Pick<Event, 'agendaMode' | 'draftAgenda'>,
  sessionCount: number,
): AgendaView {
  const hasDraft = hasRichText(event.draftAgenda)
  if (event.agendaMode === 'draft' && hasDraft) return 'draft'
  if (sessionCount > 0) return 'sessions'
  return hasDraft ? 'draft' : 'empty'
}

export type AgendaDay = {
  key: string
  date: string
  name: string | null
  sessions: Session[]
}

const dayKey = (value: string) => new Date(value).toISOString().slice(0, 10)

/**
 * Sessions grouped by calendar day, in date order, each day's sessions in
 * time order. Sessions with no start time go after the timed ones and keep
 * the order they came in. Days with no sessions are left out.
 */
export function groupSessionsByDay(
  sessions: Session[],
  days: Event['days'] = [],
): AgendaDay[] {
  const names = new Map<string, string | null>()
  for (const day of days ?? []) {
    if (day?.date) names.set(dayKey(day.date), day.name?.trim() || null)
  }
  const groups = new Map<string, AgendaDay>()
  sessions.forEach((session) => {
    if (!session.day || Number.isNaN(new Date(session.day).getTime())) return
    const key = dayKey(session.day)
    if (!groups.has(key))
      groups.set(key, {
        key,
        date: `${key}T00:00:00.000Z`,
        name: names.get(key) ?? null,
        sessions: [],
      })
    groups.get(key)!.sessions.push(session)
  })
  const ordered = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key))
  for (const group of ordered) {
    const position = new Map(group.sessions.map((s, i) => [s.id, i]))
    group.sessions.sort((a, b) => {
      const at = clockMinutes(a.startTime)
      const bt = clockMinutes(b.startTime)
      if (at != null && bt != null && at !== bt) return at - bt
      if (at != null && bt == null) return -1
      if (at == null && bt != null) return 1
      return position.get(a.id)! - position.get(b.id)!
    })
  }
  return ordered
}

const populated = <T extends { id: number }>(items: (number | T)[] | null | undefined): T[] =>
  (items ?? []).filter((item): item is T => typeof item === 'object' && item !== null)

export type SessionPeopleGroup = { label: string; speakers: Speaker[] }

/** Moderators, speakers and any custom groups on a session, with empty groups dropped. */
export function sessionPeople(session: Session): SessionPeopleGroup[] {
  const moderators = populated<Speaker>(session.moderators)
  const speakers = populated<Speaker>(session.speakers)
  return [
    { label: moderators.length > 1 ? 'Moderators' : 'Moderator', speakers: moderators },
    { label: speakers.length > 1 ? 'Speakers' : 'Speaker', speakers },
    ...(session.speakerGroups ?? []).map((group) => ({
      label: group.label,
      speakers: populated<Speaker>(group.speakers),
    })),
  ].filter((group) => group.speakers.length > 0)
}

/**
 * Everyone shown in the speakers section: the event's own roster first, in
 * the order staff set, then anyone who appears on a listed session but was
 * never added to the roster, so every name in the agenda has a bio to link to.
 */
export function eventSpeakers(
  roster: Event['speakers'],
  sessions: Session[] = [],
): Speaker[] {
  const seen = new Set<number>()
  const result: Speaker[] = []
  const add = (speaker: Speaker) => {
    if (seen.has(speaker.id)) return
    seen.add(speaker.id)
    result.push(speaker)
  }
  populated<Speaker>(roster).forEach(add)
  for (const session of sessions)
    for (const group of sessionPeople(session)) group.speakers.forEach(add)
  return result
}

/** Sponsors with their records loaded, duplicates removed, order kept. */
export function uniqueSponsors(lists: Event['sponsors'][]): Sponsor[] {
  const seen = new Set<number>()
  const result: Sponsor[] = []
  for (const list of lists)
    for (const sponsor of populated<Sponsor>(list)) {
      if (seen.has(sponsor.id)) continue
      seen.add(sponsor.id)
      result.push(sponsor)
    }
  return result
}

/** Only http(s) links are rendered, so a typo in the admin can't produce a script or mail link. */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** A map search link for the venue; no map service account or key involved. */
export function mapSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}
