import { describe, expect, it } from 'vitest'
import { clipHttpUrl, clipPublishedDate, clipLocationCatalog } from './extensionClip'
import type { Location } from '@/payload-types'

describe('clip metadata validation', () => {
  it('normalizes tracking links while retaining article identity parameters', () => {
    expect(clipHttpUrl('https://news.example/story?id=4&utm_source=email&fbclid=foo#part'))
      .toBe('https://news.example/story?id=4')
  })
  it.each(['javascript:alert(1)', 'data:text/plain,hello', 'https://user:secret@news.example/', '/relative', null])('rejects unsafe source URLs: %s', value => {
    expect(clipHttpUrl(value)).toBeUndefined()
  })
  it('requires HTTPS preview images', () => {
    expect(clipHttpUrl('http://news.example/image.jpg', true)).toBeUndefined()
  })
  it('normalizes valid dates, preserves missing dates and rejects ambiguous/impossible dates', () => {
    expect(clipPublishedDate('2026-10-17')).toBe('2026-10-17T00:00:00.000Z')
    expect(clipPublishedDate('2026-10-17T09:30:00-04:00')).toBe('2026-10-17T13:30:00.000Z')
    expect(clipPublishedDate('')).toBeUndefined()
    for (const value of ['2026-02-30', '10/11/2026', 'yesterday', '2026-10-17T09:30', 42])
      expect(() => clipPublishedDate(value)).toThrow()
  })
  it('includes hierarchy context and terminates safely on malformed location cycles', () => {
    const locations = [{ id: 1, name: 'Canada', level: 'country', parent: 2 },
      { id: 2, name: 'North America', level: 'region', parent: 1 }] as Location[]
    expect(clipLocationCatalog(locations)[0]).toEqual({ id: 1, name: 'Canada', level: 'country', parent: 2, label: 'Canada › North America' })
  })
})
