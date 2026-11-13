import { describe, expect, it } from 'vitest'

import { eventPath, eventWhere, isEventId, slugifyEventName } from './eventLinks'

describe('slugifyEventName', () => {
  it('turns event names into readable addresses', () => {
    expect(slugifyEventName('GTNF 2027')).toBe('gtnf-2027')
    expect(slugifyEventName('  InFocus: Harm Reduction Webinar ')).toBe(
      'infocus-harm-reduction-webinar',
    )
    expect(slugifyEventName('Tobacco & Nicotine — São Paulo')).toBe(
      'tobacco-and-nicotine-sao-paulo',
    )
  })

  it('tidies an address staff typed themselves', () => {
    expect(slugifyEventName('/GTNF_2027/')).toBe('gtnf-2027')
    expect(slugifyEventName('gtnf-2027')).toBe('gtnf-2027')
  })

  it('never returns something that reads as a record id, or nothing', () => {
    expect(slugifyEventName('2027')).toBe('event-2027')
    expect(slugifyEventName('!!!')).toBe('event')
  })

  it('caps the length without leaving a trailing dash', () => {
    const slug = slugifyEventName(`${'a'.repeat(79)} b c`)
    expect(slug).toBe('a'.repeat(79))
  })
})

describe('event addresses', () => {
  it('tells record ids from slugs', () => {
    expect(isEventId('12')).toBe(true)
    expect(isEventId('gtnf-2027')).toBe(false)
    expect(isEventId('12a')).toBe(false)
    expect(eventWhere('12')).toEqual({ id: { equals: 12 } })
    expect(eventWhere('gtnf-2027')).toEqual({ slug: { equals: 'gtnf-2027' } })
  })

  it('prefers the slug and falls back to the id', () => {
    expect(eventPath({ id: 12, slug: 'gtnf-2027' })).toBe('/events/gtnf-2027')
    expect(eventPath({ id: 12, slug: null })).toBe('/events/12')
    expect(eventPath({ id: 12, slug: 'gtnf-2027' }, 'livestream')).toBe(
      '/events/gtnf-2027/livestream',
    )
  })
})
