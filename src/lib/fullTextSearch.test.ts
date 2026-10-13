import { describe, expect, it } from 'vitest'

import { sortByIdOrder } from './fullTextSearch'

describe('sortByIdOrder', () => {
  it('reorders docs to match the given id order', () => {
    const docs = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }, { id: 3, title: 'C' }]
    expect(sortByIdOrder(docs, [3, 1, 2]).map((d) => d.id)).toEqual([3, 1, 2])
  })

  it('puts docs not present in idOrder at the end', () => {
    const docs = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(sortByIdOrder(docs, [2]).map((d) => d.id)).toEqual([2, 1, 3])
  })

  it('does not mutate the input array', () => {
    const docs = [{ id: 1 }, { id: 2 }]
    const original = [...docs]
    sortByIdOrder(docs, [2, 1])
    expect(docs).toEqual(original)
  })

  it('handles an empty idOrder by leaving relative order unchanged', () => {
    const docs = [{ id: 1 }, { id: 2 }]
    expect(sortByIdOrder(docs, []).map((d) => d.id)).toEqual([1, 2])
  })
})
