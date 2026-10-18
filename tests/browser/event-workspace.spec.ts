import { test, expect } from '@playwright/test'
import { fixtures as f, roleContext, signIn } from '../support/fixtures'
import { lexicalFromText } from '../../src/lib/lexical'

for (const role of ['admin', 'editor', 'gatekeeper'])
test('grouped workspace menu and live guide/event destinations: ' + role, async ({ page, context }, info) => {
  await signIn(context.request, role)
  await page.goto('/admin')
  const menu = page.locator('.nic-workspace-nav')
  await expect(page.locator('.nav--nav-hydrated')).toHaveCount(1)
  if (!await menu.getByRole('link', { name: 'Workspace overview' }).isVisible())
    await page.locator('button.nav-toggler:visible').first().click()
  const labels = role === 'admin'
    ? ['News', 'Bills', 'Publications', 'Guides', 'Data', 'Taxonomy', 'Users', 'Events', 'Analytics', 'Admin']
    : role === 'editor' ? ['News', 'Bills', 'Publications', 'Guides', 'Data', 'Events'] : ['Users', 'Events', 'Analytics']
  await expect(menu.locator('h2')).toHaveText(labels)
  await expect(page.locator('.nav-group')).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Manage Fixture conference', exact: true })).toHaveAttribute('href', `/admin/events/${f.refs.event}/manage`)
  await expect(menu.getByRole('link', { name: 'Manage Fixture past conference', exact: true })).toHaveAttribute('href', `/admin/events/${f.refs.pastEvent}/manage`)
  if (role !== 'gatekeeper') {
    const guides = await (await context.request.get('/api/guides?draft=true&limit=100')).json()
    for (const guide of guides.docs)
      await expect(menu.getByRole('region', { name: 'Guides', exact: true }).getByRole('link', { name: guide.title, exact: true })).toHaveAttribute('href', `/admin/collections/guides/${guide.id}`)
    await expect(menu.getByRole('link', { name: 'Create a publication', exact: true })).toHaveAttribute('href', '/admin/collections/publication-issues/create')
    await expect(menu.getByRole('link', { name: 'Publication Deliveries', exact: true })).toHaveAttribute('href', '/admin/collections/newsletter-deliveries')
  }
  if (role === 'admin') await page.screenshot({ path: `.test-artifacts/admin-menu-${info.project.name}.png`, fullPage: false })
  await page.goto('/admin/events?period=past')
  await expect(page.getByRole('heading', { name: 'Past events', exact: true })).toBeVisible()
  await expect(page.locator('a.nic-workspace__task').filter({ hasText: 'Fixture past conference' })).toBeVisible()
  await expect(page.locator('a.nic-workspace__task').filter({ hasText: 'Fixture conference' })).toHaveCount(0)
})

test('event dashboard scopes its program, edits, registrations, counts and role-specific tools', async ({ page, context, browser }, info) => {
  await signIn(context.request, 'admin')
  const created: { slug: string; id: number }[] = []
  const gate = await roleContext(browser, 'gatekeeper'), editor = await roleContext(browser, 'editor')
  const unique = info.project.name + '-' + crypto.randomUUID()
  async function add(slug: string, data: object) {
    const response = await context.request.post('/api/' + slug, { data })
    expect(response.status(), slug + ': ' + await response.text()).toBe(201)
    const doc = (await response.json()).doc
    created.push({ slug, id: doc.id }); return doc
  }
  try {
    const speaker = await add('speakers', { name: 'Dashboard speaker ' + unique })
    const sponsor = await add('sponsors', { name: 'Dashboard sponsor ' + unique, description: lexicalFromText('Synthetic dashboard sponsor.') })
    const event = await add('events', { name: 'Dashboard event ' + unique, channel: 'atnf', startsAt: '2099-04-10T14:00:00Z', endDate: '2099-04-11T00:00:00Z', timezone: 'America/New_York', speakers: [speaker.id], sponsors: [sponsor.id], ticketTypes: [{ name: 'General', price: 0, onSale: true }], _status: 'draft' })
    const order = await add('orders', { buyer: f.users.premium.id, event: event.id, subtotal: 0, total: 0, status: 'paid' })
    await add('event-registrations', { event: event.id, order: order.id, attendee: f.users.premium.id, attendeeName: 'Active dashboard attendee', attendeeEmail: 'active@example.invalid', ticketType: 'General', attendance: 'in-person', amountPaid: 0, status: 'active' })
    await add('event-registrations', { event: event.id, order: order.id, attendeeName: 'Cancelled dashboard attendee', attendeeEmail: 'cancelled@example.invalid', ticketType: 'General', attendance: 'virtual', amountPaid: 0, status: 'cancelled' })
    await page.goto(`/admin/events/${event.id}/manage`)
    await expect(page.getByRole('heading', { name: event.name, exact: true })).toBeVisible()
    const facts = page.locator('dl[aria-label="Event facts"]')
    await expect(facts.locator('div').filter({ hasText: 'Active attendees' }).locator('dd')).toHaveText('1')
    await expect(facts.locator('div').filter({ hasText: 'Days remaining' }).locator('dd')).not.toHaveText('0')
    await expect(page.getByRole('link', { name: 'Event settings', exact: true })).toHaveAttribute('href', `/admin/collections/events/${event.id}`)
    await expect(page.getByRole('link', { name: `Edit speaker ${speaker.name}` })).toHaveAttribute('href', `/admin/collections/speakers/${speaker.id}`)
    await expect(page.getByRole('link', { name: `Edit sponsor ${sponsor.name}` })).toHaveAttribute('href', `/admin/collections/sponsors/${sponsor.id}`)
    await page.locator('#agenda').getByRole('button', { name: 'Add session', exact: true }).click()
    await page.locator('#agenda input[name=title]').fill('Dashboard draft session')
    await page.locator('#agenda select[name=day]').selectOption(event.days[0].date)
    const responsePromise = page.waitForResponse(r => r.url().endsWith(`/api/admin/events/${event.id}/sessions`) && r.request().method() === 'POST')
    await page.locator('#agenda form').getByRole('button', { name: 'Add session', exact: true }).click()
    const sessionResponse = await responsePromise
    expect(sessionResponse.status()).toBe(200)
    const sessionId = (await sessionResponse.json()).sessionId
    created.push({ slug: 'sessions', id: sessionId })
    await expect(page.getByRole('link', { name: 'Edit session Dashboard draft session', exact: true })).toHaveAttribute('href', `/admin/collections/sessions/${sessionId}`)
    await page.getByRole('searchbox', { name: 'Find an attendee' }).fill('Active dashboard')
    await expect(page.locator('#attendees').getByRole('link', { name: 'Edit attendee Active dashboard attendee' })).toBeVisible()
    await expect(page.locator('#attendees').getByRole('link', { name: 'Edit attendee Cancelled dashboard attendee' })).toHaveCount(0)
    await page.locator('#attendees').getByRole('button', { name: 'Add existing user', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Find a user by name or email', exact: true }).fill(f.users.base.email)
    await page.locator('#attendees select[name=userId]').selectOption(String(f.users.base.id))
    await page.locator('#attendees select[name=ticketTypeName]').selectOption('General')
    await page.locator('#attendees').getByRole('button', { name: 'Add as attendee', exact: true }).click()
    await expect(facts.locator('div').filter({ hasText: 'Active attendees' }).locator('dd')).toHaveText('2')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `.test-artifacts/event-dashboard-${info.project.name}.png`, fullPage: false })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    const gatePage = await gate.newPage(); await gatePage.goto(`/admin/events/${event.id}/manage`)
    await expect(gatePage.locator('#attendees').getByRole('heading', { name: 'Attendees', exact: true })).toBeVisible()
    await expect(gatePage.getByRole('link', { name: 'Event settings', exact: true })).toHaveCount(0)
    await expect(gatePage.getByRole('heading', { name: 'Speakers', exact: true })).toHaveCount(0)
    const editorPage = await editor.newPage(); await editorPage.goto(`/admin/events/${event.id}/manage`)
    await expect(editorPage.getByRole('heading', { name: 'Speakers', exact: true })).toBeVisible()
    await expect(editorPage.getByRole('searchbox', { name: 'Find an attendee' })).toHaveCount(0)
    await page.goto('/admin/analytics?tab=events')
    await expect(page.getByRole('heading', { name: 'Event attendance', exact: true })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: event.name }).getByRole('cell').nth(1)).toHaveText('2')
    // Clean registrations/orders created by the event-scoped staff registration action too.
    for (const slug of ['event-registrations', 'orders']) {
      const docs = await (await context.request.get(`/api/${slug}?where[event][equals]=${event.id}&limit=100`)).json()
      for (const doc of docs.docs) await context.request.delete(`/api/${slug}/${doc.id}`)
      for (let i = created.length - 1; i >= 0; i--) if (created[i].slug === slug) created.splice(i, 1)
    }
  } finally {
    for (const record of created.reverse()) await context.request.delete(`/api/${record.slug}/${record.id}`)
    await gate.close(); await editor.close()
  }
})
