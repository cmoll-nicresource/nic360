import { describe, expect, it } from 'vitest'

import { tradeNumber } from './numeric'

describe('tradeNumber', () => {
  it.each([
    ['12345678901', 12345678901], ['12.5', 12.5], ['-3.25', -3.25],
    ['0', 0], [0, 0], [null, 0], [1.5, 1.5], ['1e3', 1000],
    [String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
  ])('converts %j to %j', (input, expected) => {
    expect(tradeNumber(input, 'value')).toBe(expected)
  })

  it.each([
    undefined, '', ' ', '12,345', 'abc', 'NaN', 'Infinity', '1e999',
    NaN, Infinity, -Infinity, true, [], {}, '0x10',
    '9007199254740992', '-9007199254740992',
  ])('rejects %j instead of allowing it into arithmetic or a PDF', (input) => {
    expect(() => tradeNumber(input, 'value')).toThrow(/value/)
  })
})
