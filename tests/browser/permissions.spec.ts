import { test, expect } from '@playwright/test'
import { fixtures as f, roleContext } from '../support/fixtures'

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
      member = ['base', 'premium'].includes(role),
      premium = role === 'premium'
    try {
      const article = await api.get('/api/articles/' + f.articles.us + '?depth=0')
      expect(article.status()).toBe(200)
      expect('excerpt' in (await article.json())).toBe(staff || member)
      expect(
        (await api.get('/api/articles/' + f.articles.draft + '?draft=true')).status() === 200,
      ).toBe(staff)
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
          staff || (kind === 'base' ? member : kind === 'premium' && premium),
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
      if (f.readers[role] && role !== 'unverified') {
        const response = await api.patch('/api/users/' + f.readers[role].id, {
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
      email: f.readers.premium.email,
      password: 'replacement-not-allowed',
      firstName: 'Attacker',
      lastName: 'Fixture',
    },
  })
  expect(result.status()).toBe(403)
  expect(
    (
      await request.post('/api/users/login', {
        data: { email: f.readers.premium.email, password: f.password },
      })
    ).status(),
  ).toBe(200)
})

test('public account creation cannot grant membership or email verification', async ({ request }) => {
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

test('gatekeeper subscription changes take effect for an existing reader session', async ({ browser }) => {
  const gatekeeper = await roleContext(browser, 'gatekeeper')
  const reader = await roleContext(browser, 'premium')
  try {
    for (const status of ['suspended', 'active']) {
      expect((await gatekeeper.request.patch('/api/users/' + f.readers.premium.id, { data: { status } })).status()).toBe(200)
      const response = await reader.request.get('/api/datasets/' + f.refs.dataset + '/rows')
      expect(response.status()).toBe(status === 'active' ? 200 : 403)
    }
  } finally {
    await gatekeeper.request.patch('/api/users/' + f.readers.premium.id, { data: { status: 'active' } })
    await Promise.all([gatekeeper.close(), reader.close()])
  }
})
