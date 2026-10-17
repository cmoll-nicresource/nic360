import { test, expect } from '@playwright/test'
import { fixtures as f, capturedMail, roleContext } from '../support/fixtures'
test('signup, verification, provider matching, reset and replay protection', async ({
  page,
  context,
  request,
}, info) => {
  const email =
    'reader-' + info.project.name + '-' + crypto.randomUUID() + '@signup.example.invalid'
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
  await page.getByLabel('Last name', { exact: true }).fill('Reader')
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
