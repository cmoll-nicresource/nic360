import { test, expect } from '@playwright/test'
import { createHash, randomBytes } from 'node:crypto'
import { fixtures as f, roleContext, signIn } from '../support/fixtures'
import { CLIPPER_ORIGIN, CLIPPER_REDIRECT } from '../../src/config/extension'
const site = 'http://127.0.0.1:3100'
const connectInput = () => {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, redirect_uri: CLIPPER_REDIRECT, state: randomBytes(32).toString('base64url'), code_challenge: createHash('sha256').update(verifier).digest('base64url') }
}
test('staff approval issues a single-use limited credential; imports stay drafts and revocation is immediate', async ({ browser, request }) => {
  const editor = await roleContext(browser, 'editor'), other = await roleContext(browser, 'admin')
  const input = connectInput()
  const approval = await editor.request.post('/api/extension/authorize', { headers: { Origin: site }, data: input })
  expect(approval.status()).toBe(200)
  const callback = new URL((await approval.json()).callback)
  expect(callback.searchParams.get('state')).toBe(input.state)
  expect(callback.searchParams.has('token')).toBe(false)
  const exchange = { code: callback.searchParams.get('code'), code_verifier: input.verifier, redirect_uri: input.redirect_uri }
  const wrong = await request.post('/api/extension/token', { headers: { Origin: CLIPPER_ORIGIN }, data: { ...exchange, code_verifier: 'w'.repeat(43) } })
  expect(wrong.status()).toBe(401)
  const response = await request.post('/api/extension/token', { headers: { Origin: CLIPPER_ORIGIN }, data: exchange })
  expect(response.status()).toBe(200)
  expect(response.headers()['cache-control']).toBe('no-store')
  const { token, connectionId } = await response.json()
  const headers = { Origin: CLIPPER_ORIGIN, Authorization: `Bearer ${token}` }
  expect((await request.post('/api/extension/token', { headers: { Origin: CLIPPER_ORIGIN }, data: exchange })).status()).toBe(401)
  // Use an independent cookie-free context: an opaque clipper token cannot log into the CMS.
  const me = await (await request.get('/api/staff/me', { headers })).json()
  expect(me.user).toBeFalsy()
  expect((await request.post('/api/staff', { headers, data: { name: 'Forbidden', email: 'forbidden@example.invalid', password: f.password } })).status()).toBe(403)
  const location = (await (await request.get('/api/extension/locations', { headers })).json()).locations.find((x: { name: string }) => x.name === 'United States')
  const sourceUrl = `https://news.example.invalid/${crypto.randomUUID()}`
  let id: number | undefined
  try {
    const savedResponse = await request.post('/api/extension/articles', { headers, data: {
      title: 'Synthetic extension import', excerptText: 'Editor-reviewed article excerpt.', sourceUrl: sourceUrl + '?utm_source=clipping#top',
      sourceDate: '2090-10-15T09:30:00-04:00', socialPreview: { description: 'Original social preview summary.', imageUrl: 'https://news.example.invalid/social.jpg?sig=synthetic-only' },
      locationIds: [location.id], _status: 'published',
    } })
    expect(savedResponse.status()).toBe(200); id = (await savedResponse.json()).id
    const saved = await (await editor.request.get(`/api/articles/${id}?draft=true&depth=0`)).json()
    expect(saved._status).toBe('draft'); expect(saved.sourceDate).toBe('2090-10-15T13:30:00.000Z'); expect(saved.sourceUrl).toBe(sourceUrl)
    expect(saved.locations).toEqual([location.id]); expect(saved.socialPreview.description).toBe('Original social preview summary.')
    expect(JSON.stringify(saved.excerpt)).toContain('Editor-reviewed article excerpt.')
    expect(await (await request.post('/api/extension/articles', { headers, data: { title: 'Same link', sourceUrl } })).json()).toMatchObject({ duplicate: true, id })
    expect((await request.patch(`/api/articles/${id}`, { headers, data: { _status: 'published' } })).status()).toBe(403)
    expect((await other.request.post('/api/extension/connections', { headers: { Origin: site }, data: { id: connectionId } })).status()).toBe(404)
    const list = await (await editor.request.get('/api/extension/connections')).json()
    const record = list.connections.find((x: { id: string }) => x.id === connectionId)
    expect(record).toBeTruthy(); expect(JSON.stringify(record)).not.toMatch(/token|credential_version/)
    const page = await editor.newPage(); await page.goto('/admin/connected-browsers')
    await expect(page.getByRole('heading', { name: 'Connected browsers', exact: true })).toBeVisible()
    await page.locator('article').filter({ hasText: connectionId.slice(0, 8) }).getByRole('button', { name: 'Disconnect browser' }).click()
    await expect(page.locator('article').filter({ hasText: connectionId.slice(0, 8) })).toContainText('Disconnected')
    expect((await request.get('/api/extension/locations', { headers })).status()).toBe(401)
  } finally {
    if (id) expect((await editor.request.delete('/api/articles/' + id)).status()).toBe(200)
    await editor.request.post('/api/extension/connections', { headers: { Origin: site }, data: { id: connectionId } })
    await editor.close(); await other.close()
  }
})
test('approval requires website staff sign-in, consent and an exact packaged redirect', async ({ browser, request }) => {
  const input = connectInput(), url = '/extension/connect?' + new URLSearchParams({ redirect_uri: input.redirect_uri, state: input.state, code_challenge: input.code_challenge })
  const ctx = await browser.newContext(), page = await ctx.newPage()
  await page.goto(site + url)
  await page.getByRole('link', { name: 'Sign in to Nicotine360' }).click()
  await page.getByRole('textbox', { name: 'Email *', exact: true }).fill(f.staff.editor.email)
  await page.getByLabel('Password', { exact: true }).fill(f.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Connect this browser' })).toBeVisible()
  const before = await (await ctx.request.get(site + '/api/extension/connections')).json()
  await page.route('**/api/extension/authorize', route => route.fulfill({ status: 400, json: { error: 'Synthetic approval reached.' } }))
  await page.getByRole('button', { name: 'Connect this browser' }).click()
  await expect(page.locator('p[role=alert]')).toContainText('Synthetic approval reached.')
  const after = await (await ctx.request.get(site + '/api/extension/connections')).json()
  expect(after).toEqual(before)
  expect((await request.post('/api/extension/authorize', { headers: { Origin: site }, data: input })).status()).toBe(401)
  await signIn(request, 'base')
  expect((await request.post('/api/extension/authorize', { headers: { Origin: site }, data: input })).status()).toBe(401)
  expect((await ctx.request.post(site + '/api/extension/authorize', { headers: { Origin: 'https://evil.example' }, data: input })).status()).toBe(403)
  expect((await ctx.request.post(site + '/api/extension/authorize', { headers: { Origin: site }, data: { ...input, redirect_uri: input.redirect_uri + '?bad=1' } })).status()).toBe(400)
  expect((await request.post('/api/extension/login', { data: { email: f.staff.editor.email, password: f.password } })).status()).toBe(410)
  await ctx.close()
})


test('database expiry, password changes and simultaneous exchanges invalidate credentials safely', async ({ browser, request }) => {
  const { default: pg } = await import('pg')
  const { testEnvironment } = await import('../support/environment')
  const pool = new pg.Pool({ connectionString: testEnvironment().DATABASE_URI })
  const admin = await roleContext(browser, 'admin'), staff = await browser.newContext({ baseURL: site })
  let staffId: number | undefined
  try {
    const email = 'clipper-expiry-' + crypto.randomUUID() + '@example.invalid'
    const created = await admin.request.post('/api/staff', { data: { name: 'Temporary clipper expiry fixture', email, password: f.password, role: 'editor' } })
    expect(created.status()).toBe(201); staffId = (await created.json()).doc.id
    expect((await staff.request.post('/api/staff/login', { data: { email, password: f.password } })).status()).toBe(200)
    async function code() {
      const input = connectInput()
      const approval = await staff.request.post('/api/extension/authorize', { headers: { Origin: site }, data: input })
      expect(approval.status()).toBe(200)
      return { code: new URL((await approval.json()).callback).searchParams.get('code'), code_verifier: input.verifier, redirect_uri: input.redirect_uri }
    }
    const expiredCode = await code()
    await pool.query("UPDATE clipper.codes SET expires_at=now()-interval '1 second' WHERE staff_id=$1", [staffId])
    expect((await request.post('/api/extension/token', { headers: { Origin: CLIPPER_ORIGIN }, data: expiredCode })).status()).toBe(401)
    const exchange = await code()
    const raced = await Promise.all([1,2].map(() => request.post('/api/extension/token', { headers: { Origin: CLIPPER_ORIGIN }, data: exchange })))
    expect(raced.map(x => x.status()).sort()).toEqual([200,401])
    const active = await raced.find(x => x.status() === 200)!.json()
    const headers = { Origin: CLIPPER_ORIGIN, Authorization: `Bearer ${active.token}` }
    expect((await request.get('/api/extension/locations', { headers })).status()).toBe(200)
    await pool.query("UPDATE clipper.connections SET expires_at=now()-interval '1 second' WHERE id=$1 AND staff_id=$2", [active.connectionId, staffId])
    expect((await request.get('/api/extension/locations', { headers })).status()).toBe(401)
    const next = await request.post('/api/extension/token', { headers: { Origin: CLIPPER_ORIGIN }, data: await code() })
    const { token } = await next.json()
    const pending = await code()
    expect((await admin.request.patch('/api/staff/' + staffId, { data: { password: f.password + '-changed' } })).status()).toBe(200)
    expect((await request.get('/api/extension/locations', { headers: { Origin: CLIPPER_ORIGIN, Authorization: `Bearer ${token}` } })).status()).toBe(401)
    expect((await request.post('/api/extension/token', { headers: { Origin: CLIPPER_ORIGIN }, data: pending })).status()).toBe(401)
  } finally {
    if (staffId) {
      expect((await admin.request.delete('/api/staff/' + staffId)).status()).toBe(200)
      expect(Number((await pool.query('SELECT count(*) AS total FROM clipper.connections WHERE staff_id=$1', [staffId])).rows[0].total)).toBe(0)
    }
    await pool.end(); await staff.close(); await admin.close()
  }
})
