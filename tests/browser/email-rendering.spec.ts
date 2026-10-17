import { mkdir, writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { fixtures as f, signIn } from '../support/fixtures'

for (const slug of ['us-news-clippings', 'global-news-clippings', 'vapor-news-clippings', 'daily-us-legislative-snapshot', 'weekly-us-legislative-report']) {
  test('responsive publication email: ' + slug, async ({ page, context }, info) => {
    await signIn(context.request, 'editor')
    expect(f.publications[slug], 'seeded publication').toBeTruthy()
    const item = { relationTo: slug.includes('legislative') ? 'bills' : 'articles', value: slug.includes('legislative') ? f.refs.bill : f.articles.us }
    const nested = slug !== 'us-news-clippings'
    const response = await context.request.post('/api/publication-issues/preview', { data: {
      publication: f.publications[slug], title: 'Synthetic review issue', issueDate: '2090-10-16T12:00:00Z', format: 'excerpt-list',
      sections: nested
        ? [{ heading: 'North America: Taxation', items: [item] }, { heading: 'North America: Research', items: [item] }, { heading: 'Europe: Taxation', items: [item] }]
        : [{ heading: 'Taxation', items: [item] }, { heading: 'Research', items: [item] }],
    } })
    expect(response.status()).toBe(200)
    const { html } = await response.json()
    expect(html).toContain('Unsubscribe')
    await mkdir('.test-artifacts/email-review', { recursive: true })
    await writeFile('.test-artifacts/email-review/' + slug + '.html', html)
    for (const width of [320, 390, 1200]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.setContent(html)
      if (nested) {
        await expect(page.getByRole('heading', { level: 2, name: 'North America', exact: true })).toHaveCount(1)
        await expect(page.getByRole('heading', { level: 3, name: /Research/ })).toHaveCount(1)
      } else {
        await expect(page.getByRole('heading', { level: 2, name: /Taxation/ })).toHaveCount(1)
        await expect(page.getByRole('heading', { level: 2, name: /North America/ })).toHaveCount(0)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
      await page.screenshot({ path: '.test-artifacts/email-review/' + slug + '-' + info.project.name + '-' + width + '.png', fullPage: true })
    }
  })
}
