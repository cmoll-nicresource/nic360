import { test, expect } from '@playwright/test'
import { fixtures as f } from '../support/fixtures'

test('staff clipper imports preview/date/location, preserves a draft and rejects a repeated canonical URL', async ({ request }) => {
  const origin = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const login = await request.post('/api/extension/login', {
    headers: { Origin: origin }, data: { email: f.staff.editor.email, password: f.password },
  })
  expect(login.status()).toBe(200)
  const { token } = await login.json()
  const headers = { Origin: origin, Authorization: `JWT ${token}` }
  const locationsResponse = await request.get('/api/extension/locations', { headers })
  expect(locationsResponse.status()).toBe(200)
  const location = (await locationsResponse.json()).locations.find((item: { name: string }) => item.name === 'United States')
  expect(location).toBeTruthy()
  const sourceUrl = `https://news.example.invalid/${crypto.randomUUID()}`
  let id: number | undefined
  try {
    const response = await request.post('/api/extension/articles', { headers, data: {
      title: 'Synthetic extension import', excerptText: 'Editor-reviewed article excerpt.',
      sourceUrl: sourceUrl + '?utm_source=clipping#top', sourceDate: '2090-10-15T09:30:00-04:00',
      socialPreview: { description: 'Original social preview summary.', imageUrl: 'https://news.example.invalid/social.jpg?sig=synthetic-only' },
      locationIds: [location.id], _status: 'published',
    } })
    expect(response.status()).toBe(200)
    expect(response.headers()['access-control-allow-origin']).toBe(origin)
    id = (await response.json()).id
    const saved = await (await request.get(`/api/articles/${id}?draft=true&depth=0`, { headers })).json()
    expect(saved._status).toBe('draft')
    expect(saved.sourceDate).toBe('2090-10-15T13:30:00.000Z')
    expect(saved.sourceUrl).toBe(sourceUrl)
    expect(saved.locations).toEqual([location.id])
    expect(saved.socialPreview).toEqual({ description: 'Original social preview summary.', imageUrl: 'https://news.example.invalid/social.jpg?sig=synthetic-only' })
    expect(JSON.stringify(saved.excerpt)).toContain('Editor-reviewed article excerpt.')
    expect(saved.products || []).toHaveLength(0)
    const repeated = await request.post('/api/extension/articles', { headers, data: { title: 'Same link', sourceUrl: sourceUrl + '?utm_source=other' } })
    expect(await repeated.json()).toMatchObject({ duplicate: true, id })
    const recent = await (await request.get('/api/extension/articles', { headers })).json()
    expect(recent.articles.some((article: { id: number; status: string }) => article.id === id && article.status === 'draft')).toBe(true)
    // Synthetic isolated DB only: check preview privacy after an editor publishes.
    expect((await request.patch(`/api/articles/${id}`, { headers, data: { _status: 'published' } })).status()).toBe(200)
    const teaser = await (await request.get(`/api/articles/${id}`)).json()
    expect(teaser.excerpt).toBeUndefined()
    expect(teaser.socialPreview).toBeUndefined()
  } finally {
    if (id) expect((await request.delete('/api/articles/' + id, { headers })).status()).toBe(200)
    // The source is invented and belongs only to this test run; no reader data is used.
  }
})
