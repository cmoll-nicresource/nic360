import { test, expect } from '@playwright/test'
import { fixtures as f, roleContext } from '../support/fixtures'

test('bounded concurrent reads preserve access boundaries and complete large exports', async ({ browser }, info) => {
  const anonymous = await roleContext(browser, 'anonymous')
  const subscriber = await roleContext(browser, 'premium')
  const gatekeeper = await roleContext(browser, 'gatekeeper')
  try {
    const durations: number[] = []
    let next = 0
    await Promise.all(Array.from({ length: 10 }, async () => {
      for (;;) {
        const index = next++
        if (index >= 80) break
        const allowed = index % 2 === 0
        const start = performance.now()
        const response = await (allowed ? subscriber : anonymous).request.get('/api/articles/' + f.articles.us)
        expect(response.status()).toBe(200)
        expect('excerpt' in await response.json()).toBe(allowed)
        durations.push(performance.now() - start)
      }
    }))
    durations.sort((a, b) => a - b)
    const p95 = durations[Math.ceil(durations.length * .95) - 1]
    expect(p95).toBeLessThan(10000)
    const exported = await subscriber.request.get('/api/datasets/' + f.refs.dataset + '/export?format=csv')
    expect(exported.status()).toBe(200)
    expect((await exported.text()).trim().split(/\r?\n/)).toHaveLength(5021)
    const report = await gatekeeper.request.get('/api/admin/company-reports/export?providerId=' + f.providers.premium + '&from=2090-10-10&to=2090-10-16')
    expect(report.status()).toBe(200)
    expect(await report.text()).toContain('15000')
    await info.attach('bounded-load.json', { body: JSON.stringify({ requests: 80, concurrency: 10, p95Milliseconds: p95, datasetRows: 5020, historyRows: 15000 }), contentType: 'application/json' })
  } finally {
    await Promise.all([anonymous.close(), subscriber.close(), gatekeeper.close()])
  }
})
