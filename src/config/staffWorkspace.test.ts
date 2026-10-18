import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { adminDocumentId, STAFF_TASKS, staffTasksFor } from './staffWorkspace'

const staff = (role: 'editor' | 'gatekeeper' | 'admin') =>
  ({ id: 1, collection: 'staff', role }) as PayloadRequest['user']

describe('staff workspace navigation', () => {
  it('keeps every task within admin with unique destinations', () => {
    expect(STAFF_TASKS.every((task) => task.href.startsWith('/admin/'))).toBe(true)
    expect(new Set(STAFF_TASKS.map((task) => task.href)).size).toBe(STAFF_TASKS.length)
  })
  it('does not expose staff tools to anonymous visitors or user accounts', () => {
    expect(staffTasksFor(null)).toEqual([])
    expect(
      staffTasksFor({
        id: 1,
        collection: 'users',
        role: 'admin',
      } as unknown as PayloadRequest['user']),
    ).toEqual([])
  })
  it('shows editors their tasks while reserving analytics, trademarks and access checks for gatekeepers', () => {
    const editor = staffTasksFor(staff('editor')).map((task) => task.href)
    expect(editor).toContain('/admin/trade-reports')
    expect(editor).toContain('/admin/datasets')
    expect(editor).toContain('/admin/collections/events')
    expect(editor).not.toContain('/admin/analytics')
    expect(editor).not.toContain('/admin/trademark-reports')
    expect(editor).not.toContain('/admin/access-check')
    const gatekeeper = staffTasksFor(staff('gatekeeper'))
    expect(gatekeeper.every((task) => task.audience === 'users')).toBe(true)
    expect(gatekeeper.filter((task) => task.daily).map((task) => task.label)).toEqual([
      'Manage subscriptions',
      'Register a user',
      'Register an attendee',
      'Review orders',
    ])
    expect(gatekeeper.map((task) => task.href)).not.toContain('/admin/trade-reports')
    expect(editor).toContain('/admin/collections/publication-issues/create')
    expect(staffTasksFor(staff('admin'))).toHaveLength(STAFF_TASKS.length)
  })
  it('resolves numeric tool IDs only in the expected route position', () => {
    expect(adminDocumentId({ segments: ['datasets', '12', 'import'] }, 'datasets')).toBe('12')
    expect(adminDocumentId({ segments: ['events', '123', 'manage'] }, 'events')).toBe('123')
    for (const segments of [
      ['events', '1', 'import'],
      ['datasets', 'abc', 'import'],
      ['datasets', '1', 'import', 'more'],
      ['datasets', '9007199254740992', 'import'],
      ['datasets', '-1', 'import'],
    ])
      expect(adminDocumentId({ segments }, 'datasets')).toBeUndefined()
  })
})
