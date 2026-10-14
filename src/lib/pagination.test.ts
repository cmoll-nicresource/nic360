import { describe, expect, it } from 'vitest'

import { parsePage } from './pagination'

describe('parsePage', () => {
  it('defaults to 1 when missing', () => {
    expect(parsePage(undefined)).toBe(1)
  })

  it('parses a numeric string', () => {
    expect(parsePage('3')).toBe(3)
  })

  it('takes the first value of an array (duplicate query params)', () => {
    expect(parsePage(['4', '5'])).toBe(4)
  })

  it('clamps non-numeric or sub-1 values to 1', () => {
    expect(parsePage('abc')).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-5')).toBe(1)
  })

  it('floors a fractional value', () => {
    expect(parsePage('2.7')).toBe(2)
  })
})
