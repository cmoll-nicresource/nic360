import { test, expect } from '@playwright/test'
import { capturedMail, fixtures, roleContext } from '../support/fixtures'

test('a user staff create is invited to set a password, not told to confirm an email', async ({ request, browser }) => {
  const admin = await roleContext(browser, 'admin')
  const email = 'staff-made-' + crypto.randomUUID() + '@example.invalid'
  let id: number | undefined
  try {
    const created = await admin.request.post('/api/users', {
      data: { email, firstName: 'Synthetic', lastName: 'Invitee', password: fixtures.password },
    })
    expect(created.status()).toBe(201)
    id = (await created.json()).doc.id


    const mail = await capturedMail(request, email, /account is ready/)
    expect(mail.html).toContain('Set your password')
    expect(mail.html).not.toContain(fixtures.password)
    const messages = await (await request.get('http://127.0.0.1:2526/messages')).json()
    expect(messages.some((m: { subject: string }) => m.subject.includes(email) && /Confirm your/.test(m.subject))).toBe(false)

    const unverified = await (await admin.request.get('/api/users/' + id)).json()
    expect(unverified._verified).toBe(false)

    const token = /\/reset-password\/([^"\s?]+)/.exec(mail.html)?.[1]
    expect(token).toBeTruthy()
    const password = fixtures.password + '-chosen'
    expect((await request.post('/api/users/reset-password', { data: { token, password } })).status()).toBe(200)
    expect((await request.post('/api/users/login', { data: { email, password } })).status()).toBe(200)

    const verified = await (await admin.request.get('/api/users/' + id)).json()
    expect(verified._verified).toBe(true)
  } finally {
    if (id) expect((await admin.request.delete('/api/users/' + id)).ok()).toBe(true)
    await admin.close()
  }
})

test('account email log records mail, flags a second request and issues a fresh link', async ({ request, browser }) => {
  const admin = await roleContext(browser, 'admin')
  const email = 'log-' + crypto.randomUUID() + '@example.invalid'
  let id: number | undefined
  try {
    const created = await admin.request.post('/api/users', {
      data: { email, firstName: 'Synthetic', lastName: 'Logged', password: fixtures.password },
    })
    expect(created.status()).toBe(201)
    id = (await created.json()).doc.id
    await capturedMail(request, email, /account is ready/)

    const rows = async () =>
      (await (await admin.request.get(`/api/account-emails?where[recipient][equals]=${encodeURIComponent(email)}&sort=createdAt&depth=0`)).json()).docs
    await expect.poll(async () => (await rows()).length).toBe(1)
    const [first] = await rows()
    expect(first).toMatchObject({ kind: 'account-ready', status: 'sent', stuck: false })
    expect(first.html).toContain('/reset-password/')
    expect(first.linkExpiresAt).toBeTruthy()

    expect((await request.post('/api/users/forgot-password', { data: { email } })).status()).toBe(200)
    await capturedMail(request, email, /Reset your Nicotine360 password/)
    await expect.poll(async () => (await rows()).length).toBe(2)
    expect((await rows())[1]).toMatchObject({ kind: 'reset', stuck: true })

    // Only gatekeepers and above can read the log.
    expect((await request.get('/api/account-emails')).status()).toBe(403)

    const link = await admin.request.post('/api/admin/account-emails/fresh-link', { data: { userId: id } })
    expect(link.status()).toBe(200)
    const { url } = await link.json()
    expect(url).toMatch(/\/reset-password\/[0-9a-f]+$/)
    const password = fixtures.password + '-via-link'
    expect((await request.post('/api/users/reset-password', { data: { token: url.split('/').pop(), password } })).status()).toBe(200)
    expect((await request.post('/api/users/login', { data: { email, password } })).status()).toBe(200)
    const after = await rows()
    expect(after.at(-1)).toMatchObject({ kind: 'staff-link' })
    expect(after.at(-1).html ?? null).toBeNull()

    // A cross-site request is refused.
    const crossSite = await request.post('/api/admin/account-emails/fresh-link', { data: { userId: id }, headers: { Origin: 'https://evil.invalid' } })
    expect([401, 403]).toContain(crossSite.status())
  } finally {
    if (id) await admin.request.delete('/api/users/' + id)
    await admin.close()
  }
})
