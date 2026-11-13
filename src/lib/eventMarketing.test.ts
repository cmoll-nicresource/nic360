import { describe, expect, it } from 'vitest'

import {
  audienceStats,
  deadlineCountdown,
  eventHighlights,
  eventStructuredData,
  faqEntries,
  hasAudience,
  hasHighlights,
  highlightVideo,
  jsonLdScript,
  keyDates,
} from './eventMarketing'
import { lexicalFromText } from './lexical'

describe('who attends', () => {
  it('keeps complete figures only', () => {
    const event = {
      audience: {
        stats: [
          { value: ' 400+ ', label: 'delegates' },
          { value: '38', label: ' ' },
        ],
      },
    }
    expect(audienceStats(event)).toEqual([{ value: '400+', label: 'delegates' }])
    expect(hasAudience(event)).toBe(true)
  })

  it('is absent when nothing usable was entered', () => {
    expect(hasAudience({})).toBe(false)
    expect(hasAudience({ audience: { stats: [], intro: lexicalFromText('  ') } })).toBe(false)
    expect(hasAudience({ audience: { intro: lexicalFromText('Regulators and researchers') } })).toBe(
      true,
    )
  })
})

describe('highlightVideo', () => {
  it('plays Vimeo and YouTube links on the page', () => {
    expect(highlightVideo('https://vimeo.com/76979871')).toEqual({
      embedUrl: 'https://player.vimeo.com/video/76979871',
    })
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
      'youtu.be/dQw4w9WgXcQ?t=10',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    ])
      expect(highlightVideo(link)).toEqual({
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      })
  })

  it('links to anything else and never frames it', () => {
    expect(highlightVideo('https://example.org/video/123456')).toEqual({
      linkUrl: 'https://example.org/video/123456',
    })
    expect(highlightVideo('https://example.org/?next=vimeo.com/76979871')).toEqual({
      linkUrl: 'https://example.org/?next=vimeo.com/76979871',
    })
  })

  it('ignores empty and unsafe values', () => {
    expect(highlightVideo('')).toBeNull()
    expect(highlightVideo(null)).toBeNull()
    expect(highlightVideo('javascript:alert(1)')).toBeNull()
  })
})

describe('eventHighlights', () => {
  it('keeps loaded photos with real artwork and quotes with text', () => {
    const photo = { id: 1, alt: 'Main hall', url: '/a.jpg', width: 1200, height: 800 }
    const event = {
      highlights: {
        photos: [photo, 7, { id: 2, alt: 'Placeholder', url: '/b.png', width: 1, height: 1 }],
        testimonials: [
          { quote: ' Worth the trip. ', name: 'A. Delegate', organisation: null },
          { quote: '   ' },
        ],
      },
    } as unknown as Parameters<typeof eventHighlights>[0]
    const result = eventHighlights(event)
    expect(result.photos.map((p) => p.id)).toEqual([1])
    expect(result.testimonials).toEqual([
      { quote: 'Worth the trip.', name: 'A. Delegate', organisation: '' },
    ])
    expect(result.video).toBeNull()
    expect(hasHighlights(event)).toBe(true)
  })

  it('reports nothing for an event without any', () => {
    expect(hasHighlights({})).toBe(false)
    expect(hasHighlights({ highlights: { videoUrl: ' ', photos: [], testimonials: [] } })).toBe(false)
  })
})

describe('faqEntries', () => {
  it('drops questions with no answer', () => {
    const entries = faqEntries({
      faq: [
        { question: 'Dress code?', answer: lexicalFromText('Business casual.') },
        { question: 'Parking?', answer: lexicalFromText('') },
      ],
    } as Parameters<typeof faqEntries>[0])
    expect(entries.map((e) => e.question)).toEqual(['Dress code?'])
    expect(faqEntries({})).toEqual([])
  })
})

describe('keyDates', () => {
  const event = {
    keyDates: [
      { label: 'Hotel block closes', date: '2027-08-20T00:00:00.000Z' },
      { label: 'Early-bird rate ends', date: '2027-06-30T00:00:00.000Z' },
      { label: 'Proposals due', date: '2027-03-01T00:00:00.000Z' },
      { label: ' ', date: '2027-03-01T00:00:00.000Z' },
      { label: 'Broken', date: 'not a date' },
    ],
  }

  it('sorts by date and marks the ones that have gone by', () => {
    expect(keyDates(event, '2027-06-18T15:00:00.000Z')).toEqual([
      { label: 'Proposals due', date: '2027-03-01T00:00:00.000Z', passed: true, daysLeft: -109 },
      { label: 'Early-bird rate ends', date: '2027-06-30T00:00:00.000Z', passed: false, daysLeft: 12 },
      { label: 'Hotel block closes', date: '2027-08-20T00:00:00.000Z', passed: false, daysLeft: 63 },
    ])
  })

  it('keeps a deadline open through its own day', () => {
    const [, earlyBird] = keyDates(event, '2027-06-30T23:59:00.000Z')
    expect(earlyBird).toMatchObject({ passed: false, daysLeft: 0 })
    expect(keyDates(event, '2027-07-01T00:00:00.000Z')[1]).toMatchObject({ passed: true })
  })

  it('words the countdown only when it is near', () => {
    expect(deadlineCountdown(0)).toBe('today')
    expect(deadlineCountdown(1)).toBe('tomorrow')
    expect(deadlineCountdown(12)).toBe('in 12 days')
    expect(deadlineCountdown(31)).toBe('')
    expect(deadlineCountdown(-1)).toBe('')
  })
})

describe('eventStructuredData', () => {
  const base = {
    url: 'https://nicotine360.org/events/gtnf-2027',
    siteUrl: 'https://nicotine360.org',
    window: { allDay: true, start: '20270914', endExclusive: '20270917' } as const,
  }
  const event = {
    name: 'GTNF 2027',
    tagline: 'The Global Tobacco & Nicotine Forum',
    venue: { address: 'Hilton Brussels Grand Place, Brussels' },
    hasLivestream: false,
    ticketTypes: [
      { name: 'General Admission', inPerson: { price: 1200, subscriberPrice: 900 }, virtual: { price: 400 } },
      { name: 'Academia', inPerson: { price: 0 } },
    ],
  }

  it('describes a hybrid forum with dates, both locations, speakers and public prices', () => {
    const data = eventStructuredData({
      ...base,
      event,
      channel: { format: 'hybrid' },
      imageUrl: '/api/media/file/gtnf.jpg',
      speakers: [{ name: 'Dr. Amara Nwosu', role: 'Chief Science Officer', company: 'Example Co' }],
      includeOffers: true,
    })
    expect(data).toMatchObject({
      '@type': 'Event',
      name: 'GTNF 2027',
      description: 'The Global Tobacco & Nicotine Forum',
      startDate: '2027-09-14',
      endDate: '2027-09-16',
      eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
      image: ['https://nicotine360.org/api/media/file/gtnf.jpg'],
      performer: [
        {
          '@type': 'Person',
          name: 'Dr. Amara Nwosu',
          jobTitle: 'Chief Science Officer',
          worksFor: { '@type': 'Organization', name: 'Example Co' },
        },
      ],
    })
    expect(data.location).toEqual([
      {
        '@type': 'Place',
        name: 'Hilton Brussels Grand Place, Brussels',
        address: 'Hilton Brussels Grand Place, Brussels',
      },
      { '@type': 'VirtualLocation', url: base.url },
    ])
    expect((data.offers as { name: string; price: number }[]).map((o) => [o.name, o.price])).toEqual([
      ['General Admission (in person)', 1200],
      ['General Admission (virtual)', 400],
      ['Academia (in person)', 0],
    ])
  })

  it('treats an event with no venue as online and leaves offers out once it is over', () => {
    const data = eventStructuredData({
      ...base,
      event: { ...event, venue: {}, tagline: null, description: lexicalFromText('A one-hour webinar.') },
      channel: { format: 'online' },
    })
    expect(data.eventAttendanceMode).toBe('https://schema.org/OnlineEventAttendanceMode')
    expect(data.location).toEqual({ '@type': 'VirtualLocation', url: base.url })
    expect(data.description).toBe('A one-hour webinar.')
    expect(data).not.toHaveProperty('offers')
    expect(data).not.toHaveProperty('image')
    expect(data).not.toHaveProperty('performer')
  })

  it('is in-person only when nothing virtual is sold', () => {
    const data = eventStructuredData({
      ...base,
      event: { ...event, ticketTypes: [{ name: 'Delegate', inPerson: { price: 500 } }] },
      channel: { format: 'hybrid' },
    })
    expect(data.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode')
    expect(data.location).toMatchObject({ '@type': 'Place' })
  })

  it('cannot close its script tag from CMS text', () => {
    const script = jsonLdScript({ name: '</script><script>alert(1)</script>' })
    expect(script).not.toContain('<')
    expect(JSON.parse(script).name).toBe('</script><script>alert(1)</script>')
  })
})
