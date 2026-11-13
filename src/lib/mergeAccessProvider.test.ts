import { expect, it } from 'vitest'
import { providerMergeIds } from './mergeAccessProvider'

it('accepts distinct provider IDs and rejects missing, malformed, self and out-of-range merges', () => {
  expect(providerMergeIds('12', 34)).toEqual({ sourceId: 12, targetId: 34 })
  for (const value of [null, undefined, '', 0, -1, '1.5', '1 OR 1=1', [1], {}, true, 2147483648])
    expect(() => providerMergeIds(value, 34)).toThrow('Choose two valid access providers.')
  expect(() => providerMergeIds(34, '34')).toThrow('Choose a different provider')
})
