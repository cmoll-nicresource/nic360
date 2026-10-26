import { test, expect } from '@playwright/test'
import { capturedMail, fixtures, roleContext } from '../support/fixtures'

test('staff reset email has a working absolute admin link and branded content', async ({ page, request, browser }) => {
  const admin = await roleContext(browser, 'admin')
  const email = 'staff-email-' + crypto.randomUUID() + '@example.invalid'
  let id: number | undefined
  try {
    const created = await admin.request.post('/api/staff', {
      data: { email, name: 'Synthetic Email Review', role: 'editor', password: fixtures.password },
    })
    expect(created.status()).toBe(201)
    id = (await created.json()).doc.id
    expect((await request.post('/api/staff/forgot-password', { data: { email } })).status()).toBe(200)
    const mail = await capturedMail(request, email, /Reset your Nicotine360 staff password/)
    const href = /href="([^"]+\/admin\/reset\/[^" ]+)"/.exec(mail.html)?.[1]
    expect(href).toBeTruthy()
    const url = new URL(href!)
    expect(url.origin).toBe('http://127.0.0.1:3100')
    expect(mail.html).toContain('alt="Nicotine360"')
    expect(mail.html).toContain('expires in one hour')
    expect(mail.html).toContain('copy this complete address')
    expect(mail.html).not.toMatch(/(?:href|src)="\//)
    await page.goto(url.href)
    await expect(page.locator('input[type="password"]')).toHaveCount(2)
    const password = fixtures.password + '-email-reset'
    expect((await request.post('/api/staff/reset-password', {
      data: { token: url.pathname.split('/').pop(), password },
    })).status()).toBe(200)
    expect((await request.post('/api/staff/login', { data: { email, password } })).status()).toBe(200)
    // A normal browser navigation has Fetch Metadata, even without an Origin header.
    const signedIn = await browser.newContext({ baseURL: url.origin })
    try {
      expect((await signedIn.request.post('/api/staff/login', { data: { email, password } })).status()).toBe(200)
      const workspace = await signedIn.newPage()
      await workspace.goto('/admin')
      await expect(workspace).toHaveURL(/\/admin(?:\?.*)?$/)
    } finally {
      await signedIn.close()
    }
  } finally {
    if (id) expect((await admin.request.delete('/api/staff/' + id)).ok()).toBe(true)
    await admin.close()
  }
})
