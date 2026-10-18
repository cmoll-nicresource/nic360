import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { WorkspaceDashboard } from './WorkspaceDashboard'
import type { AdminViewServerProps } from 'payload'
vi.mock('./WorkspaceShell', () => ({
  requireWorkspaceRole: (props: AdminViewServerProps) => props.initPageResult.req,
  TaskIcon: () => null,
  WorkspacePage: ({ title, children }: { title: string; children: never }) =>
    createElement('main', null, createElement('h1', null, title), children),
}))
async function render(role: string) {
  const find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    count = vi.fn().mockResolvedValue({ totalDocs: 0 })
  const props = {
    initPageResult: {
      req: { user: { id: 1, role, collection: 'staff' }, payload: { find, count } },
    },
  } as unknown as AdminViewServerProps
  return { html: renderToStaticMarkup(await WorkspaceDashboard(props)), find, count }
}
describe('staff dashboard daily workflows', () => {
  it('queries and presents only user operations for gatekeepers', async () => {
    const { html, find, count } = await render('gatekeeper')
    expect(find.mock.calls.map(([query]) => query.collection).sort()).toEqual(['orders', 'users'])
    expect(count.mock.calls.map(([query]) => query.collection)).toEqual(['email-flags'])
    for (const text of [
      'Manage subscriptions',
      'Register a user',
      'Register an attendee',
      'Review orders',
      'Orders needing attention',
    ])
      expect(html).toContain(text)
    for (const text of [
      'Trade Barometer',
      'Publication drafts',
      'News library',
      'Staff accounts',
      'Taxonomy &amp; reference',
    ])
      expect(html).not.toContain(text)
  })
  it('puts excerpt entry and drafts before periodic reports for editors', async () => {
    const { html, find } = await render('editor')
    expect(find.mock.calls.map(([query]) => query.collection).sort()).toEqual([
      'articles',
      'bills',
      'publication-issues',
    ])
    expect(html.indexOf('Add a news excerpt')).toBeLessThan(
      html.indexOf('Editorial work in progress'),
    )
    expect(html.indexOf('Editorial work in progress')).toBeLessThan(html.indexOf('Trade Barometer'))
    expect(html).not.toContain('Manage subscriptions')
    expect(html).not.toContain('Staff accounts')
  })
  it('gives admins both daily workflows and administration', async () => {
    const { html } = await render('admin')
    for (const text of [
      'Add a news excerpt',
      'Manage subscriptions',
      'Staff accounts',
      'Taxonomy &amp; reference data',
    ])
      expect(html).toContain(text)
  })
})
