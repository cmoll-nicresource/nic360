import { describe, expect, it } from 'vitest'

import { buildUserSearchWhere, MIN_USER_SEARCH_LENGTH } from './userSearch'

describe('buildUserSearchWhere', () => {
  it('returns null below the minimum length', () => {
    expect(buildUserSearchWhere('')).toBeNull()
    expect(buildUserSearchWhere('a')).toBeNull()
    expect(buildUserSearchWhere('ab')).toBeNull()
  })

  it('returns a where clause at the minimum length', () => {
    expect(MIN_USER_SEARCH_LENGTH).toBe(3)
    expect(buildUserSearchWhere('abc')).not.toBeNull()
  })

  it('trims whitespace before checking length', () => {
    expect(buildUserSearchWhere('  ab  ')).toBeNull()
    expect(buildUserSearchWhere('  abc  ')).not.toBeNull()
  })

  it('matches first name, last name or email', () => {
    expect(buildUserSearchWhere('mega')).toEqual({
      or: [{ firstName: { contains: 'mega' } }, { lastName: { contains: 'mega' } }, { email: { contains: 'mega' } }],
    })
  })

  it('uses the trimmed query in the clause, not the raw input', () => {
    const where = buildUserSearchWhere('  clarke  ')
    expect(where).toEqual({
      or: [{ firstName: { contains: 'clarke' } }, { lastName: { contains: 'clarke' } }, { email: { contains: 'clarke' } }],
    })
  })
})
