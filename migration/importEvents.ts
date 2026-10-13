/**
 * Migrates Speakers, Sponsors, Events, Event days and Sessions from the
 * old site. Deliberately NOT migrated: `attendees` (864 rows) and
 * `discounts` (109 rows) — real ticket pricing isn't recoverable (the old
 * site's only ticket-shaped data, 25 rows in the e-commerce `products`
 * table tagged category='Ticket', has no link to any event and prices
 * that look like test data, e.g. $5/$4 and $3.40/$0), and every
 * EventRegistration here requires an Order with a real ticketType,
 * attendance mode and amountPaid — fabricating those for 864 real past
 * attendees would manufacture fake-looking financial records. The
 * already-skipped a-la-carte Orders system covers the same ground.
 *
 * Events/Sponsors/Speakers/Sessions are upserted by name/title (matches
 * the seed placeholders where names coincide, e.g. "GTNF 2026" — the old
 * site's real dates win over the seed's placeholder ones).
 *
 * Usage: npx tsx migration/importEvents.ts
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import zlib from 'zlib'
import { getPayload } from 'payload'

import config from '../src/payload.config'
import { editorJsToParagraphs } from '../src/lib/editorJsImport'
import { lexicalFromParagraphs, lexicalFromText } from '../src/lib/lexical'

const DUMP_PATH = path.join(process.cwd(), 'old-db', 'truecms.sql.gz')
const NULL = '\\N'
const clean = (v: string | undefined) => (v === undefined || v === NULL || v === '' ? undefined : v)

async function streamTable(
  tableName: string,
  onRow: (fields: string[]) => void | Promise<void>,
): Promise<void> {
  const copyPrefix = `COPY public.${tableName} (`
  let inBlock = false
  const rl = readline.createInterface({
    input: fs.createReadStream(DUMP_PATH).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    if (!inBlock) {
      if (line.startsWith(copyPrefix)) inBlock = true
      continue
    }
    if (line === '\\.') break
    // Awaited deliberately — several callers do an async find-or-create
    // per row, which would otherwise race (readline doesn't wait for a
    // fire-and-forget callback before handing it the next line).
    await onRow(line.split('\t'))
  }
  rl.close()
}

function toISODate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const d = new Date(raw + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function toISODateTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const d = new Date(raw.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return undefined
  if (d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) return undefined
  return d.toISOString()
}

/** Combines a plain date with an "HH:MM" time string into one instant. */
function combineDateAndTime(dateISO: string | undefined, time: string | undefined): string | undefined {
  if (!dateISO) return undefined
  const [h, m] = (time ?? '00:00').split(':').map(Number)
  const d = new Date(dateISO)
  if (Number.isNaN(d.getTime())) return undefined
  d.setUTCHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0)
  return d.toISOString()
}

function jsonBlocksToRichText(raw: string | undefined, fallback: string | undefined) {
  let paragraphs: string[] = []
  if (raw) {
    try {
      paragraphs = editorJsToParagraphs(JSON.parse(raw))
    } catch {
      // not valid JSON — fall through to the fallback
    }
  }
  if (paragraphs.length > 0) return lexicalFromParagraphs(paragraphs)
  return fallback ? lexicalFromText(fallback) : undefined
}

/** The old site stored a free bio string JSON-encoded (not EditorJS blocks). */
function jsonStringField(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') {
      const cleaned = parsed.replace(/\r\n/g, '\n').trim()
      return cleaned.length > 0 ? cleaned : undefined
    }
  } catch {
    // not valid JSON — fall through
  }
  return undefined
}

const CHANNEL_BY_OLD_ID: Record<string, 'gtnf' | 'atnf' | 'infocus'> = { '1': 'gtnf', '5': 'atnf', '4': 'infocus' }
// Only exact IANA-zone matches to the new schema's fixed option list; no
// approximations (e.g. Europe/Athens has no close match and is left unset).
const TIMEZONE_MAP: Record<string, string> = {
  'America/New_York': 'America/New_York',
  'Europe/Brussels': 'Europe/Paris',
  'Europe/Paris': 'Europe/Paris',
  'Europe/London': 'Europe/London',
}

const SESSION_TYPE_MAP: Record<string, 'Keynote' | 'Panel' | 'Break' | 'Other'> = {
  Keynote: 'Keynote',
  Panel: 'Panel',
  Break: 'Break',
}

const EVENT_COL = {
  id: 0, channelId: 1, name: 2, startDate: 3, endDate: 4, timezone: 5, replay: 7,
  description: 8, locationDescription: 9, createdAt: 11, tagline: 13, startTime: 17,
}
const DAY_COL = { id: 0, eventId: 1, title: 2, date: 3 }
const AGENDA_COL = { id: 0, eventDayId: 1, title: 2, startTime: 4, endTime: 5, sessionType: 6 }
const SPEAKER_COL = { id: 0, name: 1, role: 2, company: 3, description: 4 }
const SPONSOR_COL = { id: 0, company: 1, description: 2 }
const SPEAKER_ROLE_COL = { speakerId: 1, role: 2, agendaId: 5 }
const LIVESTREAM_COL = { eventId: 1, link: 2, embed: 3 }

async function main() {
  const payload = await getPayload({ config })

  console.log('Importing Speakers...')
  const speakerIdByOldId = new Map<string, string | number>()
  await streamTable('speakers', async (f) => {
    const oldId = f[SPEAKER_COL.id]
    const name = clean(f[SPEAKER_COL.name])
    if (!name) return
    const data = {
      name,
      role: clean(f[SPEAKER_COL.role]),
      company: clean(f[SPEAKER_COL.company]),
      bio: jsonStringField(f[SPEAKER_COL.description]),
    }
    const existing = await payload.find({ collection: 'speakers', where: { name: { equals: name } }, limit: 1, overrideAccess: true })
    const doc =
      existing.docs.length > 0
        ? await payload.update({ collection: 'speakers', id: existing.docs[0].id, data, overrideAccess: true })
        : await payload.create({ collection: 'speakers', data, overrideAccess: true })
    speakerIdByOldId.set(oldId, doc.id)
  })
  console.log(`  ${speakerIdByOldId.size} speakers`)

  console.log('Importing Sponsors...')
  const sponsorIdByOldId = new Map<string, string | number>()
  await streamTable('sponsors', async (f) => {
    const oldId = f[SPONSOR_COL.id]
    const name = clean(f[SPONSOR_COL.company])
    if (!name) return
    const data = { name, description: jsonBlocksToRichText(clean(f[SPONSOR_COL.description]), name) }
    const existing = await payload.find({ collection: 'sponsors', where: { name: { equals: name } }, limit: 1, overrideAccess: true })
    const doc =
      existing.docs.length > 0
        ? await payload.update({ collection: 'sponsors', id: existing.docs[0].id, data, overrideAccess: true })
        : await payload.create({ collection: 'sponsors', data, overrideAccess: true })
    sponsorIdByOldId.set(oldId, doc.id)
  })
  console.log(`  ${sponsorIdByOldId.size} sponsors`)

  console.log('Reading events_sponsors / agendas_sponsors...')
  const sponsorIdsByEventId = new Map<string, Set<string>>()
  await streamTable('events_sponsors', (f) => {
    const [eventId, sponsorId] = f
    const set = sponsorIdsByEventId.get(eventId) ?? new Set<string>()
    set.add(sponsorId)
    sponsorIdsByEventId.set(eventId, set)
  })
  const sponsorIdsByAgendaId = new Map<string, Set<string>>()
  await streamTable('agendas_sponsors', (f) => {
    const [agendaId, sponsorId] = f
    const set = sponsorIdsByAgendaId.get(agendaId) ?? new Set<string>()
    set.add(sponsorId)
    sponsorIdsByAgendaId.set(agendaId, set)
  })

  console.log('Reading speaker_roles...')
  const speakerRolesByAgendaId = new Map<string, { speakerId: string; role: string }[]>()
  await streamTable('speaker_roles', (f) => {
    const agendaId = f[SPEAKER_ROLE_COL.agendaId]
    if (!clean(agendaId)) return
    const list = speakerRolesByAgendaId.get(agendaId) ?? []
    list.push({ speakerId: f[SPEAKER_ROLE_COL.speakerId], role: f[SPEAKER_ROLE_COL.role] })
    speakerRolesByAgendaId.set(agendaId, list)
  })

  console.log('Reading event_days...')
  const daysByEventId = new Map<string, { title: string | undefined; date: string }[]>()
  const eventIdByDayId = new Map<string, string>()
  const dayDateById = new Map<string, string>()
  await streamTable('event_days', (f) => {
    const dayId = f[DAY_COL.id]
    const eventId = f[DAY_COL.eventId]
    const dateISO = toISODate(clean(f[DAY_COL.date]))
    if (!dateISO) return
    eventIdByDayId.set(dayId, eventId)
    dayDateById.set(dayId, dateISO)
    const list = daysByEventId.get(eventId) ?? []
    list.push({ title: clean(f[DAY_COL.title]), date: dateISO })
    daysByEventId.set(eventId, list)
  })

  console.log('Reading event_livestreams...')
  const livestreamByEventId = new Map<string, string>()
  await streamTable('event_livestreams', (f) => {
    const eventId = f[LIVESTREAM_COL.eventId]
    const link = clean(f[LIVESTREAM_COL.link])
    const embed = clean(f[LIVESTREAM_COL.embed])
    const src = link ?? embed?.match(/src="([^"]+)"/)?.[1]
    if (src) livestreamByEventId.set(eventId, src)
  })

  console.log('\nImporting Events...')
  const eventIdByOldId = new Map<string, string | number>()
  await streamTable('events', async (f) => {
    const oldId = f[EVENT_COL.id]
    const name = clean(f[EVENT_COL.name])
    if (!name) return
    const channel = CHANNEL_BY_OLD_ID[f[EVENT_COL.channelId]]
    if (!channel) return

    const startDateISO = toISODate(clean(f[EVENT_COL.startDate]))
    const startsAt = combineDateAndTime(startDateISO, clean(f[EVENT_COL.startTime])) ?? startDateISO
    const endDate = toISODate(clean(f[EVENT_COL.endDate])) ?? startDateISO
    if (!startsAt || !endDate) return

    const oldDays = daysByEventId.get(oldId) ?? []
    const livestreamUrl = livestreamByEventId.get(oldId)

    const data = {
      name,
      channel,
      startsAt,
      endDate,
      timezone: TIMEZONE_MAP[clean(f[EVENT_COL.timezone]) ?? ''] as
        | 'Pacific/Honolulu' | 'America/Anchorage' | 'America/Los_Angeles' | 'America/Denver' | 'America/Chicago'
        | 'America/New_York' | 'America/Sao_Paulo' | 'Europe/London' | 'Europe/Paris' | 'Africa/Nairobi'
        | 'Asia/Dubai' | 'Asia/Kolkata' | 'Asia/Shanghai' | 'Asia/Tokyo' | 'Australia/Sydney' | undefined,
      hasReplay: clean(f[EVENT_COL.replay]) === 't',
      hasLivestream: !!livestreamUrl,
      livestreamUrl,
      tagline: clean(f[EVENT_COL.tagline]),
      description: jsonBlocksToRichText(clean(f[EVENT_COL.description]), name),
      venue: { description: jsonBlocksToRichText(clean(f[EVENT_COL.locationDescription]), undefined) },
      days: oldDays.map((d) => ({ date: d.date, name: d.title ?? '' })),
      sponsors: [...(sponsorIdsByEventId.get(oldId) ?? [])].map((id) => sponsorIdByOldId.get(id)).filter(Boolean),
      _status: 'published' as const,
    }

    const existing = await payload.find({ collection: 'events', where: { name: { equals: name } }, limit: 1, overrideAccess: true })
    const doc =
      existing.docs.length > 0
        ? await payload.update({ collection: 'events', id: existing.docs[0].id, data, overrideAccess: true })
        : await payload.create({ collection: 'events', data, overrideAccess: true })
    eventIdByOldId.set(oldId, doc.id)
  })
  console.log(`  ${eventIdByOldId.size} events`)

  console.log('\nImporting Sessions...')
  let sessionsCreated = 0
  let sessionsUpdated = 0
  let sessionsSkipped = 0
  await streamTable('agendas', async (f) => {
    const oldAgendaId = f[AGENDA_COL.id]
    const title = clean(f[AGENDA_COL.title])
    const dayId = f[AGENDA_COL.eventDayId]
    const dayDate = dayDateById.get(dayId)
    const oldEventId = eventIdByDayId.get(dayId)
    const newEventId = oldEventId ? eventIdByOldId.get(oldEventId) : undefined
    if (!title || !dayDate || !newEventId) {
      sessionsSkipped++
      return
    }

    const roles = speakerRolesByAgendaId.get(oldAgendaId) ?? []
    const moderators = roles.filter((r) => r.role === 'moderator').map((r) => speakerIdByOldId.get(r.speakerId)).filter(Boolean)
    const speakerIds = roles.filter((r) => r.role !== 'moderator').map((r) => speakerIdByOldId.get(r.speakerId)).filter(Boolean)
    const sponsors = [...(sponsorIdsByAgendaId.get(oldAgendaId) ?? [])].map((id) => sponsorIdByOldId.get(id)).filter(Boolean)

    const data = {
      event: newEventId,
      title,
      day: dayDate,
      startTime: combineDateAndTime(dayDate, clean(f[AGENDA_COL.startTime])),
      endTime: combineDateAndTime(dayDate, clean(f[AGENDA_COL.endTime])),
      type: SESSION_TYPE_MAP[clean(f[AGENDA_COL.sessionType]) ?? ''] ?? 'Other',
      moderators,
      speakers: speakerIds,
      sponsors,
      _status: 'published' as const,
    }

    const existing = await payload.find({
      collection: 'sessions',
      where: { and: [{ event: { equals: newEventId } }, { title: { equals: title } }, { day: { equals: dayDate } }] },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      await payload.update({ collection: 'sessions', id: existing.docs[0].id, data, overrideAccess: true })
      sessionsUpdated++
    } else {
      await payload.create({ collection: 'sessions', data, overrideAccess: true })
      sessionsCreated++
    }
  })
  console.log(`  ${sessionsCreated} created, ${sessionsUpdated} updated, ${sessionsSkipped} skipped (missing day/event/title)`)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
