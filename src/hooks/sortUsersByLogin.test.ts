import { expect, it } from 'vitest'
import { loginOrderPages } from './sortUsersByLogin'

it('keeps all dated users ahead of undated users across every page boundary', () => {
  for (let count = 0; count < 12; count++) {
    for (let limit = 1; limit < 6; limit++) {
      const dated = Array.from({ length: count }, (_, id) => `dated-${id}`)
      const undated = Array.from({ length: 15 }, (_, id) => `undated-${id}`)
      const expected = [...dated, ...undated]
      for (let page = 1; page < 12; page++) {
        const result = loginOrderPages(count, page, limit).flatMap(segment => {
          const group = segment.dated ? dated : undated
          const start = (segment.page - 1) * limit
          return group.slice(start, start + limit).slice(segment.skip, segment.skip + segment.take)
        })
        expect(result).toEqual(expected.slice((page - 1) * limit, page * limit))
      }
    }
  }
})
