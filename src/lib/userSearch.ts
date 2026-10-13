import type { Where } from 'payload'

export const MIN_USER_SEARCH_LENGTH = 3

/** Matches first name, last name or email containing the query. Returns null below the minimum length, so the caller can skip querying entirely (there are 1000+ users — no reasonable list UI for "all of them"). */
export function buildUserSearchWhere(query: string): Where | null {
  const q = query.trim()
  if (q.length < MIN_USER_SEARCH_LENGTH) return null

  return {
    or: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }],
  }
}
