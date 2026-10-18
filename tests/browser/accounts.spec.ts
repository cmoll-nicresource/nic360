import { test, expect } from '@playwright/test'
import { fixtures as f, capturedMail, roleContext } from '../support/fixtures'
test('signup, verification, provider matching, reset and replay protection', async ({
  page,
  context,
  request,
}, info) => {
  const email =
    'user-' + info.project.name + '-' + crypto.randomUUID() + '@signup.example.invalid'
  await page.goto('/signup')
  await page.getByLabel('Work email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click()
  await page.getByLabel('Verification code', { exact: true }).waitFor()
  const mail = await capturedMail(request, email, /verification code/),
    code = /verification code: (\d{6})/.exec(mail.subject)![1]
  expect(
    (
      await request.post('/api/auth/signup/verify-code', { data: { email, code: 'not-a-code' } })
    ).status(),
  ).toBe(400)
  await page.getByLabel('Verification code', { exact: true }).fill(code)
  const verification = page.waitForResponse(response => response.url().endsWith('/api/auth/signup/verify-code') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.getByText('Fixture premium', { exact: true })).toBeVisible()
  const proof = (await context.cookies()).find((c) => c.name === 'nic360-signup-proof')
  expect(proof?.httpOnly).toBe(true)
  // WebKit's cookie inspection reports None on HTTP localhost; verify the wire contract.
  const setCookie = (await (await verification).allHeaders())['set-cookie']
  expect(setCookie).toMatch(/samesite=strict/i)
  expect(setCookie).toMatch(/httponly/i)
  await page.getByLabel('First name', { exact: true }).fill('Synthetic')
  await page.getByLabel('Last name', { exact: true }).fill('User')
  await page.getByLabel('Password', { exact: true }).fill(f.password)
  await page.getByLabel('Confirm password', { exact: true }).fill(f.password)
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.waitForURL('**/signup/finish')
  const me = await (await context.request.get('/api/users/me')).json()
  expect(me.user.accessProvider?.id ?? me.user.accessProvider).toBe(f.providers.premium)
  expect((await context.request.get('/api/datasets/' + f.refs.dataset + '/rows')).status()).toBe(
    200,
  )
  expect(
    (
      await context.request.post('/api/auth/signup/complete', {
        data: { email, password: 'changed-not-allowed', firstName: 'Replay', lastName: 'Fixture' },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await context.request.post('/api/auth/signup/verify-code', { data: { email, code } })
    ).status(),
  ).toBe(400)
  await context.request.post('/api/users/logout')
  await page.goto('/forgot-password')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  const reset = await capturedMail(request, email, /Reset your/),
    url = /href="([^"]*\/reset-password\/[^" ]+)"/.exec(reset.html)![1]
  await page.goto(url)
  const nextPassword = f.password + '-new'
  await page.getByLabel('New password', { exact: true }).fill(nextPassword)
  await page.getByLabel('Confirm password', { exact: true }).fill(nextPassword)
  await page.getByRole('button', { name: 'Set password and sign in', exact: true }).click()
  await page.waitForURL('**/account')
  expect(
    (
      await context.request.post('/api/users/login', { data: { email, password: nextPassword } })
    ).status(),
  ).toBe(200)
  expect(
    (
      await context.request.post('/api/users/login', { data: { email, password: f.password } })
    ).ok(),
  ).toBe(false)
  const token = url.split('/').pop()!
  expect(
    (
      await context.request.post('/api/users/reset-password', {
        data: { token, password: 'replay-not-allowed' },
      })
    ).ok(),
  ).toBe(false)
})
test('verification attempts expire and five wrong guesses cannot be bypassed', async ({
  request,
  browser,
}, info) => {
  const email =
    'attempts-' + info.project.name + '-' + crypto.randomUUID() + '@signup.example.invalid'
  expect((await request.post('/api/auth/signup/start', { data: { email } })).status()).toBe(200)
  expect((await request.post('/api/auth/signup/start', { data: { email } })).status()).toBe(429)
  const code = /verification code: (\d{6})/.exec(
    (await capturedMail(request, email, /verification code/)).subject,
  )![1]
  for (let i = 0; i < 5; i++)
    expect(
      (
        await request.post('/api/auth/signup/verify-code', { data: { email, code: 'invalid' } })
      ).status(),
    ).toBe(400)
  expect(
    (await request.post('/api/auth/signup/verify-code', { data: { email, code } })).status(),
  ).toBe(400)
  const gate = await roleContext(browser, 'gatekeeper')
  try {
    const user = (
      await (
        await gate.request.get('/api/users?where[email][equals]=' + encodeURIComponent(email))
      ).json()
    ).docs[0]
    await gate.request.patch('/api/users/' + user.id, {
      data: { signup: { codeExpiresAt: '2000-01-01' } },
    })
    expect(
      (await request.post('/api/auth/signup/verify-code', { data: { email, code } })).status(),
    ).toBe(400)
  } finally {
    await gate.close()
  }
})

test('migrated account sets a password without repeating signup or changing its company and preferences', async ({ browser, request }, info) => {
  const admin = await roleContext(browser, 'admin'), user = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const email = 'migrated-' + info.project.name + '-' + crypto.randomUUID() + '@signup.example.invalid'
  const oldPassword = crypto.randomUUID(), oldSession = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  let id: number | undefined
  try {
    const created = await admin.request.post('/api/users', { data: {
      email, password: oldPassword, firstName: 'Migrated', lastName: 'User', _verified: true,
      // Deliberately differs from the Premium domain match: manual assignments must survive.
      accessProvider: f.providers.base, emailPublications: [f.publications['us-news-clippings']], status: 'active',
    } })
    expect(created.status()).toBe(201); id = (await created.json()).doc.id
    expect((await oldSession.request.post('/api/users/login', { data: { email, password: oldPassword } })).status()).toBe(200)
    const page = await user.newPage()
    await page.goto('/signup'); await page.getByLabel('Work email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Send verification code', exact: true }).click()
    await expect(page.getByRole('link', { name: 'set a new password', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'set a new password', exact: true }).click()
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('If that email matches an account')
    const reset = await capturedMail(request, email, /Reset your/)
    const url = /href="([^"]*\/reset-password\/[^" ]+)"/.exec(reset.html)![1], token = url.split('/').pop()!
    const before = await (await admin.request.get('/api/users/' + id + '?depth=0')).json()
    expect(before.firstName).toBe('Migrated'); expect(before.accessProvider).toBe(f.providers.base)
    expect(before.emailPublications).toEqual([f.publications['us-news-clippings']])
    expect((await request.post('/api/users/reset-password', { data: { token, password: 'short' } })).status()).toBe(400)
    await page.goto(url)
    await page.getByLabel('New password', { exact: true }).fill(f.password + '-migrated')
    await page.getByLabel('Confirm password', { exact: true }).fill(f.password + '-migrated')
    await page.getByRole('button', { name: 'Set password and sign in', exact: true }).click()
    await page.waitForURL('**/account')
    expect((await (await oldSession.request.get('/api/users/me')).json()).user).toBeFalsy()
    await expect(page.getByRole('link', { name: 'Change password', exact: true })).toBeVisible()
    const after = await (await admin.request.get('/api/users/' + id + '?depth=0')).json()
    for (const field of ['id','firstName','lastName','accessProvider','emailPublications','status','_verified']) expect(after[field]).toEqual(before[field])
    expect((await user.request.get('/api/datasets/' + f.refs.dataset + '/rows')).status()).toBe(403)
    expect((await request.post('/api/users/reset-password', { data: { token, password: f.password + '-replay' } })).ok()).toBe(false)
    expect((await user.request.post('/api/users/login', { data: { email, password: f.password + '-migrated' } })).status()).toBe(200)
    expect((await (await admin.request.get('/api/users?where[email][equals]=' + encodeURIComponent(email))).json()).totalDocs).toBe(1)
  } finally { if(id) await admin.request.delete('/api/users/' + id); await oldSession.close(); await user.close(); await admin.close() }
})

test('reset errors stay recoverable and unknown emails do not reveal accounts', async ({ page, request }) => {
  await page.goto('/forgot-password')
  await page.route('**/api/users/forgot-password', route => route.fulfill({ status: 503, json: { error: 'synthetic transport failure' } }))
  await page.getByLabel('Email', { exact: true }).fill('synthetic@example.invalid')
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  await expect(page.locator('p[role=alert]')).toContainText('Could not request a reset link')
  await expect(page.getByRole('button', { name: 'Send reset link', exact: true })).toBeEnabled()
  await page.unroute('**/api/users/forgot-password')
  await page.getByLabel('Email', { exact: true }).fill('unknown-' + crypto.randomUUID() + '@example.invalid')
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('If that email matches an account')
  await page.goto('/reset-password/not-a-valid-token')
  await page.getByLabel('New password', { exact: true }).fill(f.password)
  await page.getByLabel('Confirm password', { exact: true }).fill(f.password)
  await page.getByRole('button', { name: 'Set password and sign in', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Request a new reset link', exact: true })).toBeVisible()
  expect((await request.post('/api/users/reset-password', { data: { token: 'not-a-valid-token', password: f.password } })).ok()).toBe(false)
})

test('expired reset tokens fail and a suspended user remains suspended after a reset', async ({ browser, request }, info) => {
  const { default: pg } = await import('pg'), { testEnvironment } = await import('../support/environment')
  const pool = new pg.Pool({ connectionString: testEnvironment().DATABASE_URI }), admin = await roleContext(browser, 'admin')
  const email = 'expired-reset-' + info.project.name + '-' + crypto.randomUUID() + '@example.invalid'
  let id: number | undefined
  try {
    const response = await admin.request.post('/api/users', { data: { email, password: crypto.randomUUID(), _verified: true, status: 'suspended', accessProvider: f.providers.premium } })
    expect(response.status()).toBe(201); id = (await response.json()).doc.id
    await request.post('/api/users/forgot-password', { data: { email } })
    const reset = await capturedMail(request, email, /Reset your/), token = /\/reset-password\/([^"< ]+)/.exec(reset.html)![1]
    const row = (await pool.query('SELECT reset_password_expiration FROM users WHERE id=$1', [id])).rows[0]
    expect(new Date(row.reset_password_expiration).getTime() - Date.now()).toBeGreaterThan(3500000)
    expect(new Date(row.reset_password_expiration).getTime() - Date.now()).toBeLessThanOrEqual(3600000)
    await pool.query("UPDATE users SET reset_password_expiration=now()-interval '1 second' WHERE id=$1", [id])
    expect((await request.post('/api/users/reset-password', { data: { token, password: f.password + '-expired' } })).status()).toBe(403)
    // Clear only this fixture's resend cooldown, then use the real resend endpoint.
    await pool.query('UPDATE users SET reset_password_requested_at=NULL WHERE id=$1', [id])
    expect((await request.post('/api/users/forgot-password', { data: { email } })).status()).toBe(200)
    const fresh = await capturedMail(request, email, /Reset your/), freshToken = /\/reset-password\/([^"< ]+)/.exec(fresh.html)![1]
    expect(freshToken).not.toBe(token)
    expect((await request.post('/api/users/reset-password', { data: { token, password: f.password + '-old-link' } })).status()).toBe(403)
    expect((await request.post('/api/users/reset-password', { data: { token: freshToken, password: f.password + '-suspended' } })).status()).toBe(200)
    const user = await (await request.get('/api/users/me')).json()
    expect(user.user.status).toBe('suspended')
    expect((await request.get('/api/datasets/' + f.refs.dataset + '/rows')).status()).toBe(403)
    expect((await (await admin.request.get('/api/users/' + id)).json()).status).toBe('suspended')
  } finally { if(id) await admin.request.delete('/api/users/' + id); await pool.end(); await admin.close() }
})

test('signup without a matching subscriber company creates pending access rather than a subscription', async ({ page, context, request, browser }, info) => {
  const email = 'unmatched-' + info.project.name + '-' + crypto.randomUUID() + '@new-company.example.invalid'
  const companyName = 'Synthetic signup company ' + crypto.randomUUID(), admin = await roleContext(browser, 'admin')
  let userId: number | undefined, providerId: number | undefined
  try {
    await page.goto('/signup'); await page.getByLabel('Work email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Send verification code', exact: true }).click()
    const code = /verification code: (\d{6})/.exec((await capturedMail(request, email, /verification code/)).subject)![1]
    await page.getByLabel('Verification code', { exact: true }).fill(code)
    await page.getByRole('button', { name: 'Verify', exact: true }).click()
    await page.getByLabel('First name', { exact: true }).fill('New')
    await page.getByLabel('Last name', { exact: true }).fill('User')
    await page.getByLabel('Company name', { exact: true }).fill(companyName)
    await page.getByLabel('Password', { exact: true }).fill(f.password)
    await page.getByLabel('Confirm password', { exact: true }).fill(f.password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await page.waitForURL('**/signup/finish')
    const me = await (await context.request.get('/api/users/me')).json()
    userId = me.user.id; providerId = me.user.accessProvider?.id ?? me.user.accessProvider
    expect(providerId).toBeTruthy()
    const provider = await (await admin.request.get('/api/access-providers/' + providerId)).json()
    expect(provider).toMatchObject({ name: companyName, plan: 'none', status: 'pending' })
    expect((await context.request.get('/api/datasets/' + f.refs.dataset + '/rows')).status()).toBe(403)
  } finally {
    // Locate only this run's synthetic fixture if completion failed midway.
    if (!userId) userId = (await (await admin.request.get('/api/users?where[email][equals]=' + encodeURIComponent(email))).json()).docs[0]?.id
    if (!providerId) providerId = (await (await admin.request.get('/api/access-providers?where[name][equals]=' + encodeURIComponent(companyName))).json()).docs[0]?.id
    if (userId) await admin.request.delete('/api/users/' + userId)
    if (providerId) await admin.request.delete('/api/access-providers/' + providerId)
    await admin.close()
  }
})
