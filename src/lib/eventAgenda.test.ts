import { describe, expect, it } from 'vitest'

import type { Session, Speaker, Sponsor } from '@/payload-types'
import { lexicalFromText } from './lexical'
import {
  agendaView,
  eventSpeakers,
  groupSessionsByDay,
  hasRichText,
  mapSearchUrl,
  safeExternalUrl,
  sessionPeople,
  uniqueSponsors,
} from './eventAgenda'

const speaker = (id: number, name: string) => ({ id, name }) as Speaker
const session = (overrides: Partial<Session>) =>
  ({ id: 1, title: 'Session', day: '2027-09-08T00:00:00.000Z', type: 'Panel', ...overrides }) as Session
const emptyDoc = lexicalFromText('')
const draft = lexicalFromText('Day one: opening keynote, speaker to be confirmed')

describe('hasRichText', () => {
  it('treats missing and blank documents as empty', () => {
    expect(hasRichText(null)).toBe(false)
    expect(hasRichText(undefined)).toBe(false)
    expect(hasRichText(emptyDoc)).toBe(false)
    expect(hasRichText(lexicalFromText('   '))).toBe(false)
    expect(hasRichText(draft)).toBe(true)
  })
})

describe('agendaView', () => {
  it('shows the draft while staff have it selected, even once sessions exist', () => {
    expect(agendaView({ agendaMode: 'draft', draftAgenda: draft }, 12)).toBe('draft')
  })

  it('shows sessions once staff switch over, keeping the draft out of sight', () => {
    expect(agendaView({ agendaMode: 'sessions', draftAgenda: draft }, 12)).toBe('sessions')
  })

  it('treats events from before the setting existed as full agendas', () => {
    expect(agendaView({ agendaMode: null, draftAgenda: null }, 3)).toBe('sessions')
  })

  it('falls back to whichever agenda exists', () => {
    expect(agendaView({ agendaMode: 'draft', draftAgenda: emptyDoc }, 4)).toBe('sessions')
    expect(agendaView({ agendaMode: 'sessions', draftAgenda: draft }, 0)).toBe('draft')
  })

  it('is empty when there is nothing to show', () => {
    expect(agendaView({ agendaMode: 'draft', draftAgenda: null }, 0)).toBe('empty')
    expect(agendaView({ agendaMode: 'sessions', draftAgenda: emptyDoc }, 0)).toBe('empty')
  })
})

describe('groupSessionsByDay', () => {
  const days = [
    { date: '2027-09-08T00:00:00.000Z', name: 'Registration Day' },
    { date: '2027-09-09T00:00:00.000Z', name: '  ' },
  ]

  it('orders days by date and sessions by start time', () => {
    const grouped = groupSessionsByDay(
      [
        session({ id: 1, day: '2027-09-09T00:00:00.000Z', startTime: '1970-01-01T14:00:00.000Z' }),
        session({ id: 2, day: '2027-09-08T00:00:00.000Z', startTime: '1970-01-01T11:00:00.000Z' }),
        session({ id: 3, day: '2027-09-09T00:00:00.000Z', startTime: '1970-01-01T09:00:00.000Z' }),
        session({ id: 4, day: '2027-09-08T00:00:00.000Z', startTime: '1970-01-01T09:30:00.000Z' }),
      ],
      days,
    )
    expect(grouped.map((d) => d.key)).toEqual(['2027-09-08', '2027-09-09'])
    expect(grouped.map((d) => d.sessions.map((s) => s.id))).toEqual([
      [4, 2],
      [3, 1],
    ])
  })

  it('carries day names and ignores blank ones', () => {
    const grouped = groupSessionsByDay(
      [
        session({ id: 1, day: '2027-09-08T00:00:00.000Z' }),
        session({ id: 2, day: '2027-09-09T00:00:00.000Z' }),
      ],
      days,
    )
    expect(grouped.map((d) => d.name)).toEqual(['Registration Day', null])
  })

  it('puts sessions without a time after timed ones, in their original order', () => {
    const grouped = groupSessionsByDay([
      session({ id: 1 }),
      session({ id: 2, startTime: '1970-01-01T15:00:00.000Z' }),
      session({ id: 3 }),
      session({ id: 4, startTime: '1970-01-01T08:00:00.000Z' }),
    ])
    expect(grouped[0].sessions.map((s) => s.id)).toEqual([4, 2, 1, 3])
  })

  it('compares migrated times, which carry the session date, by clock time only', () => {
    const grouped = groupSessionsByDay([
      session({ id: 1, startTime: '2027-09-08T16:00:00.000Z' }),
      session({ id: 2, startTime: '1970-01-01T10:00:00.000Z' }),
    ])
    expect(grouped[0].sessions.map((s) => s.id)).toEqual([2, 1])
  })

  it('groups a day stored at any hour under the same date and skips unusable days', () => {
    const grouped = groupSessionsByDay([
      session({ id: 1, day: '2027-09-08T00:00:00.000Z' }),
      session({ id: 2, day: '2027-09-08T04:00:00.000Z' }),
      session({ id: 3, day: 'not a date' }),
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].sessions.map((s) => s.id)).toEqual([1, 2])
  })

  it('returns nothing for no sessions', () => {
    expect(groupSessionsByDay([], days)).toEqual([])
  })
})

describe('sessionPeople', () => {
  it('labels moderators, speakers and custom groups, singular or plural', () => {
    const groups = sessionPeople(
      session({
        moderators: [speaker(1, 'Ana')],
        speakers: [speaker(2, 'Ben'), speaker(3, 'Cy')],
        speakerGroups: [{ label: 'Respondents', speakers: [speaker(4, 'Di')] }],
      }),
    )
    expect(groups.map((g) => [g.label, g.speakers.map((s) => s.name)])).toEqual([
      ['Moderator', ['Ana']],
      ['Speakers', ['Ben', 'Cy']],
      ['Respondents', ['Di']],
    ])
  })

  it('drops empty groups and relationships that were not loaded', () => {
    expect(sessionPeople(session({ moderators: [], speakers: null }))).toEqual([])
    expect(
      sessionPeople(session({ speakers: [7], speakerGroups: [{ label: 'Panel', speakers: [] }] })),
    ).toEqual([])
  })
})

describe('eventSpeakers', () => {
  it('lists the roster first, then anyone only named on a session, each once', () => {
    const ana = speaker(1, 'Ana')
    const ben = speaker(2, 'Ben')
    const cy = speaker(3, 'Cy')
    const result = eventSpeakers(
      [ben, ana],
      [session({ moderators: [ana], speakers: [cy, ben] })],
    )
    expect(result.map((s) => s.name)).toEqual(['Ben', 'Ana', 'Cy'])
  })

  it('is just the roster while the draft agenda is showing', () => {
    expect(eventSpeakers([speaker(1, 'Ana')]).map((s) => s.name)).toEqual(['Ana'])
    expect(eventSpeakers(null)).toEqual([])
  })
})

describe('uniqueSponsors', () => {
  it('merges lists in order without repeats and skips unloaded ids', () => {
    const a = { id: 1, name: 'A' } as Sponsor
    const b = { id: 2, name: 'B' } as Sponsor
    expect(uniqueSponsors([[a, 9, b], [b, a], null]).map((s) => s.name)).toEqual(['A', 'B'])
  })
})

describe('safeExternalUrl', () => {
  it('accepts web links and adds https to bare domains', () => {
    expect(safeExternalUrl('https://example.org/book')).toBe('https://example.org/book')
    expect(safeExternalUrl(' example.org/book ')).toBe('https://example.org/book')
  })

  it('refuses anything that is not a web link', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('mailto:someone@example.org')).toBeNull()
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
  })
})

describe('mapSearchUrl', () => {
  it('encodes the venue address', () => {
    expect(mapSearchUrl('Lansdowne Resort, Leesburg, VA')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Lansdowne%20Resort%2C%20Leesburg%2C%20VA',
    )
  })
})
