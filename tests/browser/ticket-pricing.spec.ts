import { test, expect } from '@playwright/test'
import { roleContext } from '../support/fixtures'

test('public ticket prices advertise subscriber savings and checkout shows the applicable rate', async ({ browser, page }, info) => {
  const admin = await roleContext(browser, 'admin')
  const subscriber = await roleContext(browser, 'base')
  const nonSubscriber = await roleContext(browser, 'none')
  let id: number | undefined
  try {
    const result = await admin.request.post('/api/events', { data: {
      name: 'Ticket prices ' + crypto.randomUUID(), channel: 'atnf', startsAt: '2099-04-10T14:00:00Z',
      endDate: '2099-04-11T00:00:00Z', timezone: 'America/New_York', _status: 'published',
      ticketTypes: [
        { name: 'General', inPerson: { price: 1200, subscriberPrice: 900 }, virtual: { price: 400, subscriberPrice: 300 } },
        { name: 'Online only', virtual: { price: 50 } },
      ],
    } })
    expect(result.ok()).toBe(true)
    id = (await result.json()).doc.id
    await page.goto(`/events/${id}`)
    const prices = page.getByRole('region', { name: 'Ticket prices', exact: true })
    await expect(prices).toContainText('Non-subscriber')
    await expect(prices).toContainText('$1,200.00')
    await expect(prices).toContainText('$900.00')
    await expect(prices).toContainText('Subscribers save $300.00 per ticket.')
    await expect(page.getByRole('link', { name: 'Sign in to register', exact: true })).toBeVisible()
    await prices.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `.test-artifacts/ticket-prices-${info.project.name}.png` })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    for (const [context, amount, label] of [[subscriber, '$900.00', 'subscriber price'], [nonSubscriber, '$1200.00', 'non-subscriber price']] as const) {
      const checkout = await context.newPage()
      await checkout.goto(`/events/${id}`)
      const form = checkout.locator('#tickets form')
      await expect(form).toContainText(`${amount} per ticket (${label})`)
      await form.getByLabel('Ticket type').selectOption('Online only')
      await expect(form.getByLabel('Attendance')).toHaveValue('virtual')
      await expect(form).toContainText('$50.00 per ticket')
      await expect(form.getByRole('button', { name: 'Buy tickets', exact: true })).toBeEnabled()
    }
    const edit = await admin.newPage()
    await edit.goto(`/admin/collections/events/${id}`)
    await expect(edit.getByLabel('Legacy eligibility flag', { exact: true })).toBeHidden()
    await expect(edit.getByLabel('On Sale', { exact: true })).toBeHidden()
  } finally {
    if (id) await admin.request.delete(`/api/events/${id}`)
    await Promise.all([admin.close(), subscriber.close(), nonSubscriber.close()])
  }
})
