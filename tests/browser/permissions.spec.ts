import { test, expect } from '@playwright/test'
import { fixtures as f, roleContext, signIn } from '../support/fixtures'
import { lexicalFromText } from '../../src/lib/lexical'

const marks: Record<string, number> = {}
const bills: Record<string, number> = {}
let draftEvent: number, draftSession: number

test('users default to latest login with blank dates last, including filtered pagination', async ({ browser }) => {
  const admin = await roleContext(browser, 'admin'), ids: number[] = []
  const prefix = 'login-sort-' + crypto.randomUUID()
  const dates = [null, '2090-01-01T00:00:00.000Z', null, '2090-03-01T00:00:00.000Z', '2090-02-01T00:00:00.000Z']
  try {
    for (let index = 0; index < dates.length; index++) {
      const response = await admin.request.post('/api/users', { data: { email: `${prefix}-${index}@example.invalid`, password: f.password, _verified: true, status: 'active', lastLoginAt: dates[index] } })
      expect(response.status()).toBe(201)
      ids.push((await response.json()).doc.id)
    }
    const found: number[] = []
    for (let page = 1; page <= 3; page++) {
      const response = await admin.request.get(`/api/users?where[email][contains]=${prefix}&limit=2&page=${page}`)
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.totalDocs).toBe(5)
      found.push(...data.docs.map((user: { id: number }) => user.id))
    }
    expect(found.slice(0, 3)).toEqual([ids[3], ids[4], ids[1]])
    expect(new Set(found.slice(3))).toEqual(new Set([ids[0], ids[2]]))
    const unlimited = await (await admin.request.get(`/api/users?where[email][contains]=${prefix}&limit=0`)).json()
    expect(unlimited.docs).toHaveLength(5)
    expect(unlimited.docs.slice(0, 3).map((user: { id: number }) => user.id)).toEqual([ids[3], ids[4], ids[1]])
    const page = await admin.newPage()
    await page.goto(`/admin/collections/users?where[email][contains]=${prefix}`)
    const links = page.locator('tbody a[href^="/admin/collections/users/"]')
    await expect(links).toHaveCount(5)
    expect((await links.allTextContents()).slice(0, 3)).toEqual([`${prefix}-3@example.invalid`, `${prefix}-4@example.invalid`, `${prefix}-1@example.invalid`])
    const emailSort = await (await admin.request.get(`/api/users?where[email][contains]=${prefix}&sort=email`)).json()
    expect(emailSort.docs.map((user: { id: number }) => user.id)).toEqual(ids)
  } finally {
    for (const id of ids) await admin.request.delete('/api/users/' + id)
    await admin.close()
  }
})
test.beforeAll(async ({ request }) => {
  await signIn(request, 'editor')
  const event = await request.post('/api/events', { data: { name: 'Permission draft conference', channel: 'infocus', startsAt: '2090-10-01T12:00:00Z', endDate: '2090-10-02T12:00:00Z', _status: 'draft' } })
  expect(event.status()).toBe(201)
  draftEvent = (await event.json()).doc.id
  const session = await request.post('/api/sessions', { data: { event: f.refs.event, title: 'Permission draft agenda', day: '2090-10-01T12:00:00Z', type: 'Panel', _status: 'draft' } })
  expect(session.status()).toBe(201)
  draftSession = (await session.json()).doc.id
  for (const status of ['published', 'draft']) {
    const response = await request.post('/api/trademarks', { data: { title: 'Permission fixture ' + status + ' mark', _status: status } })
    expect(response.status()).toBe(201)
    marks[status] = (await response.json()).doc.id
    const bill = await request.post('/api/bills', { data: { title: 'Permission fixture ' + status + ' bill', billType: 'Bill', billNumber: 'TEST-' + status, billDate: '2090-10-15T12:00:00Z', abstract: lexicalFromText('Permission full legislative abstract ' + status), fullText: lexicalFromText('Permission full legislative text ' + status), _status: status } })
    expect(bill.status()).toBe(201)
    bills[status] = (await bill.json()).doc.id
  }
})
test.afterAll(async ({ request }) => {
  await signIn(request, 'editor')
  for (const id of Object.values(marks)) await request.delete('/api/trademarks/' + id)
  for (const id of Object.values(bills)) await request.delete('/api/bills/' + id)
  if (draftSession) await request.delete('/api/sessions/' + draftSession)
  if (draftEvent) await request.delete('/api/events/' + draftEvent)
})

for (const role of [
  'anonymous',
  'none',
  'base',
  'premium',
  'suspended',
  'unverified',
  'expired',
  'editor',
  'gatekeeper',
  'admin',
])
  test('endpoint permissions: ' + role, async ({ browser }) => {
    const ctx = await roleContext(browser, role),
      api = ctx.request,
      staff = !!f.staff[role],
      subscriber = ['base', 'premium'].includes(role),
      premium = role === 'premium'
    try {
      const portalHtml = await (await api.get('/bills/itrac')).text()
      expect(portalHtml.includes('itrac.example.invalid')).toBe(staff || subscriber)
      expect(portalHtml.includes('<iframe')).toBe(staff || subscriber)
      const article = await api.get('/api/articles/' + f.articles.us + '?depth=0')
      expect((await api.get('/api/events/' + f.refs.event)).status()).toBe(200)
      expect((await api.get('/api/events/' + draftEvent + '?draft=true')).status() === 200).toBe(staff)
      expect((await api.get('/api/sessions/' + draftSession + '?draft=true')).status() === 200).toBe(staff)
      expect((await (await api.get('/events/' + draftEvent + '/livestream')).text()).includes('Permission draft conference')).toBe(staff)
      expect(article.status()).toBe(200)
      expect('excerpt' in (await article.json())).toBe(staff || subscriber)
      expect(
        (await api.get('/api/articles/' + f.articles.draft + '?draft=true')).status() === 200,
      ).toBe(staff)
      const rendered = await api.get('/articles/' + f.articles.us)
      expect(rendered.status()).toBe(200)
      expect((await rendered.text()).includes('Synthetic full excerpt for us.')).toBe(staff || subscriber)
      expect(await (await api.get('/articles/' + f.articles.draft)).text()).not.toContain('Fixture draft')
      for (const status of ['published', 'draft']) {
        const allowed = staff || (subscriber && status === 'published')
        expect((await api.get('/api/trademarks/' + marks[status] + '?draft=true')).status() === 200).toBe(allowed)
        const html = await (await api.get('/trademarks/' + marks[status])).text()
        expect(html.includes('Permission fixture ' + status + ' mark')).toBe(allowed)
      }
      const listing = await (await api.get('/trademarks?keyword=Permission%20fixture')).text()
      expect(listing.includes('Permission fixture draft mark')).toBe(staff)
      for (const status of ['published', 'draft']) {
        const allowed = staff || status === 'published'
        const response = await api.get('/api/bills/' + bills[status] + '?draft=true')
        expect(response.status() === 200).toBe(allowed)
        if (response.ok()) expect('abstract' in await response.json()).toBe(staff || subscriber)
        const html = await (await api.get('/bills/' + bills[status])).text()
        expect(html.includes('Permission fixture ' + status + ' bill')).toBe(allowed)
        expect(html.includes('Permission full legislative abstract ' + status)).toBe(allowed && (staff || subscriber))
      }
      expect((await (await api.get('/bills?keyword=Permission%20fixture')).text()).includes('Permission fixture draft bill')).toBe(staff)
      for (const path of [
        '/api/datasets/' + f.refs.dataset + '/rows',
        '/api/datasets/' + f.refs.dataset + '/export?format=csv',
      ])
        expect((await api.get(path)).status() === 200, path).toBe(staff || premium)
      for (const kind of ['base', 'premium', 'draft']) {
        const response = await api.get(
          '/api/guide-files/file/' + encodeURIComponent(f.files[kind].filename),
        )
        expect(response.status() === 200, 'protected ' + kind + ' PDF').toBe(
          staff || (kind === 'base' ? subscriber : kind === 'premium' && premium),
        )
        if (response.ok()) expect((await response.body()).subarray(0, 5).toString()).toBe('%PDF-')
      }
      expect(
        (
          await api.get(
            '/api/admin/company-reports/export?providerId=' +
              f.providers.premium +
              '&from=2090-10-10&to=2090-10-16',
          )
        ).status() === 200,
      ).toBe(['gatekeeper', 'admin'].includes(role))
      expect((await api.get('/api/subjects?limit=1')).status()).toBe(200)
      const subject = await (await api.get('/api/subjects/' + f.refs.subject)).json()
      expect(subject.legacyId).toBe(role === 'admin' ? 'synthetic-old-subject' : undefined)
      if (staff) {
        const issue = await (await api.get('/api/publication-issues/' + f.refs.issue + '?draft=true&depth=0')).json()
        expect(issue.legacyId).toBe(role === 'admin' ? 'synthetic-old-issue' : undefined)
      }
      const taxonomy = await api.post('/api/subjects', {
        data: { name: 'Permission ' + role + ' ' + crypto.randomUUID() },
      })
      expect(taxonomy.status()).toBe(role === 'admin' ? 201 : 403)
      if (taxonomy.status() === 201)
        expect((await api.delete('/api/subjects/' + (await taxonomy.json()).doc.id)).ok()).toBe(
          true,
        )
      const directory = await api.get('/api/staff?limit=100')
      if (staff) {
        expect(directory.ok()).toBe(true)
        const ids = (await directory.json()).docs.map((d: { id: number }) => d.id)
        expect(ids.length).toBe(role === 'admin' ? 3 : 1)
        if (role !== 'admin') expect(ids).toEqual([f.staff[role].id])
      } else expect(directory.ok()).toBe(false)
      if (f.users[role] && role !== 'unverified') {
        const response = await api.patch('/api/users/' + f.users[role].id, {
          data: {
            accessProvider: f.providers.premium,
            status: role === 'suspended' ? 'active' : 'suspended',
            signup: { completedAt: null },
          },
        })
        expect(response.status()).toBe(200)
        const doc = (await response.json()).doc
        const original =
          role === 'expired'
            ? f.providers.expired
            : role === 'suspended'
              ? f.providers.premium
              : f.providers[role]
        expect(
          typeof doc.accessProvider === 'object' ? doc.accessProvider?.id : doc.accessProvider,
        ).toBe(original)
        expect(doc.status).toBe(role === 'suspended' ? 'suspended' : 'active')
      }
      if (!staff) {
        for (const path of [
          '/api/publication-issues/' + f.refs.issue + '/build-from-rules',
          '/api/publication-issues/preview',
          '/api/trade-reports/import-preview',
          '/api/datasets/' + f.refs.dataset + '/import-preview',
          '/api/admin/events/' + f.refs.event + '/attendees',
        ])
          expect((await api.post(path, { data: {} })).status(), path).toBe(403)
      }
    } finally {
      await ctx.close()
    }
  })

test('signup completion cannot reset a known verified account without current proof', async ({
  request,
}) => {
  const result = await request.post('/api/auth/signup/complete', {
    data: {
      email: f.users.premium.email,
      password: 'replacement-not-allowed',
      firstName: 'Attacker',
      lastName: 'Fixture',
    },
  })
  expect(result.status()).toBe(403)
  expect(
    (
      await request.post('/api/users/login', {
        data: { email: f.users.premium.email, password: f.password },
      })
    ).status(),
  ).toBe(200)
})

test('public account creation cannot grant subscription or email verification', async ({ request }) => {
  const email = 'public-create-' + crypto.randomUUID() + '@example.invalid'
  const response = await request.post('/api/users', { data: {
    email, password: f.password, firstName: 'Synthetic', lastName: 'Public',
    status: 'suspended', _verified: true, accessProvider: f.providers.premium,
    signup: { completedAt: new Date().toISOString(), code: 'injected' },
  } })
  expect(response.status()).toBe(201)
  const user = (await response.json()).doc
  expect(user.accessProvider).toBeFalsy()
  expect(user._verified).not.toBe(true)
  expect(user.signup?.completedAt).toBeFalsy()
  expect(user.status).toBe('active')
})

test('staff cannot elevate their own role', async ({ browser }) => {
  const ctx = await roleContext(browser, 'editor')
  try {
    const response = await ctx.request.patch('/api/staff/' + f.staff.editor.id, { data: { role: 'admin' } })
    expect(response.status()).toBe(200)
    expect((await response.json()).doc.role).toBe('editor')
  } finally { await ctx.close() }
})

test('gatekeeper subscription changes take effect for an existing user session', async ({ browser }) => {
  const gatekeeper = await roleContext(browser, 'gatekeeper')
  const user = await roleContext(browser, 'premium')
  try {
    for (const status of ['suspended', 'active']) {
      expect((await gatekeeper.request.patch('/api/users/' + f.users.premium.id, { data: { status } })).status()).toBe(200)
      const response = await user.request.get('/api/datasets/' + f.refs.dataset + '/rows')
      expect(response.status()).toBe(status === 'active' ? 200 : 403)
    }
  } finally {
    await gatekeeper.request.patch('/api/users/' + f.users.premium.id, { data: { status: 'active' } })
    await Promise.all([gatekeeper.close(), user.close()])
  }
})
