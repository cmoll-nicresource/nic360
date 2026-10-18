import { expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { workspaceMenuFor } from './workspaceMenu'

const staff = (role: string) => ({ id: 1, collection: 'staff', role }) as PayloadRequest['user']
const data = { guides: [{ id: 7, title: 'Subscriber guide' }], past: { id: 9, name: 'Past conference' }, upcoming: { id: 10, name: 'Next conference' }, current: [{ id: 11, name: 'Current conference' }] }
it('presents the requested order and resolves guide/event links to actual records', () => {
  const groups = workspaceMenuFor(staff('admin'), data)
  expect(groups.map(group => group.label)).toEqual(['News', 'Bills', 'Publications', 'Guides', 'Data', 'Taxonomy', 'Users', 'Events', 'Analytics', 'Admin'])
  expect(groups.find(group => group.label === 'Guides')?.links[0]).toEqual({ label: 'Subscriber guide', href: '/admin/collections/guides/7' })
  const events = groups.find(group => group.label === 'Events')!.links
  expect(events.slice(0, 3).map(link => link.href)).toEqual(['/admin/events/9/manage', '/admin/events/11/manage', '/admin/events/10/manage'])
})
it('keeps editorial work away from gatekeepers and user/admin work away from editors', () => {
  expect(workspaceMenuFor(staff('gatekeeper'), data).map(group => group.label)).toEqual(['Users', 'Events', 'Analytics'])
  const editor = workspaceMenuFor(staff('editor'), data)
  expect(editor.map(group => group.label)).toEqual(['News', 'Bills', 'Publications', 'Guides', 'Data', 'Events'])
  expect(editor.flatMap(group => group.links).map(link => link.href)).not.toContain('/admin/trademark-reports')
  expect(workspaceMenuFor(null, data)).toEqual([])
  expect(workspaceMenuFor({ ...staff('admin'), collection: 'users' } as PayloadRequest['user'], data)).toEqual([])
})
it('handles an empty installation without inventing guide or event destinations', () => {
  const groups = workspaceMenuFor(staff('admin'), { guides: [], current: [] })
  expect(groups.find(group => group.label === 'Events')!.links.map(link => link.label)).toEqual(['Create new event', 'Past events', 'All events'])
})
