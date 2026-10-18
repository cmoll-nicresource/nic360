import type { Payload, PayloadRequest } from 'payload'
import { isStaffUser } from '@/access/staffRoles'
import { canSeeEditorialWorkspace } from '@/config/workspaceVisibility'
import { workspaceMenuFor } from '@/config/workspaceMenu'

/** Request-scoped, access-controlled lookups; no shared cache of staff content. */
export async function getWorkspaceMenu(payload: Payload, user: PayloadRequest['user'], now = new Date()) {
  if (!isStaffUser(user)) return []
  const options = { user, overrideAccess: false as const, depth: 0, draft: true }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const dayStart = `${today}T00:00:00.000Z`
  const [guides, past, upcoming, current] = await Promise.all([
    canSeeEditorialWorkspace(user)
      ? payload.find({ collection: 'guides', pagination: false, limit: 0, sort: 'title', select: { title: true }, ...options })
      : Promise.resolve({ docs: [] }),
    payload.find({ collection: 'events', where: { endDate: { less_than: dayStart } }, sort: '-endDate', limit: 1, select: { name: true }, ...options }),
    payload.find({ collection: 'events', where: { startsAt: { greater_than: now.toISOString() } }, sort: 'startsAt', limit: 1, select: { name: true }, ...options }),
    payload.find({ collection: 'events', where: { and: [{ startsAt: { less_than_equal: now.toISOString() } }, { endDate: { greater_than_equal: dayStart } }] }, sort: 'startsAt', pagination: false, limit: 0, select: { name: true }, ...options }),
  ])
  return workspaceMenuFor(user, { guides: guides.docs, past: past.docs[0], upcoming: upcoming.docs[0], current: current.docs })
}
