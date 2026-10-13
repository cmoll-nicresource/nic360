import { describe, expect, it } from 'vitest'

import { adSlotCount, buildActiveAdsWhere, isAdSlotBeforeIndex, isValidAdWindow } from './publicationAds'

describe('adSlotCount', () => {
  it('has no slots for an empty issue', () => {
    expect(adSlotCount(0)).toBe(0)
    expect(adSlotCount(-1)).toBe(0)
  })

  it('matches the worked example: 1 slot for 1 item, up to 3 slots for 5 items', () => {
    expect(adSlotCount(1)).toBe(1)
    expect(adSlotCount(2)).toBe(1)
    expect(adSlotCount(3)).toBe(2)
    expect(adSlotCount(4)).toBe(2)
    expect(adSlotCount(5)).toBe(3)
    expect(adSlotCount(6)).toBe(3)
  })
})

describe('isAdSlotBeforeIndex', () => {
  it('places slots before items 0, 2, 4… (i.e. story 1, 3, 5…)', () => {
    expect(isAdSlotBeforeIndex(0)).toBe(true)
    expect(isAdSlotBeforeIndex(1)).toBe(false)
    expect(isAdSlotBeforeIndex(2)).toBe(true)
    expect(isAdSlotBeforeIndex(3)).toBe(false)
    expect(isAdSlotBeforeIndex(4)).toBe(true)
  })
})

describe('isValidAdWindow', () => {
  it('accepts an end date on or after the start date', () => {
    expect(isValidAdWindow('2026-01-01', '2026-01-31')).toBe(true)
    expect(isValidAdWindow('2026-01-01', '2026-01-01')).toBe(true)
  })

  it('rejects an end date before the start date', () => {
    expect(isValidAdWindow('2026-01-31', '2026-01-01')).toBe(false)
  })
})

describe('buildActiveAdsWhere', () => {
  it('filters by publication and an active campaign window', () => {
    const now = new Date('2026-06-15T00:00:00.000Z')
    expect(buildActiveAdsWhere(42, now)).toEqual({
      and: [
        { publication: { equals: 42 } },
        { startDate: { less_than_equal: '2026-06-15T00:00:00.000Z' } },
        { endDate: { greater_than_equal: '2026-06-15T00:00:00.000Z' } },
      ],
    })
  })
})
