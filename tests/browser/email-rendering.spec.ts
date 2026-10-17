import { mkdir, writeFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { fixtures as f, signIn } from '../support/fixtures'

for (const slug of ['us-news-clippings', 'global-news-clippings', 'vapor-news-clippings', 'daily-us-legislative-snapshot', 'weekly-us-legislative-report']) {
  test('responsive publication email: ' + slug, async ({ page, context }, info) => {
    await signIn(context.request, 'editor')
    expect(f.publications[slug], 'seeded publication').toBeTruthy()
    const response = await context.request.post('/api/publication-issues/preview', { data: {
      publication: f.publications[slug], title: 'Synthetic review issue', issueDate: '2090-10-16T12:00:00Z', format: 'excerpt-list',
      sections: [{ heading: 'Review section', items: [{ relationTo: slug.includes('legislative') ? 'bills' : 'articles', value: slug.includes('legislative') ? f.refs.bill : f.articles.us }] }],
    } })
    expect(response.status()).toBe(200)
    const { html } = await response.json()
    expect(html).toContain('Unsubscribe')
    await mkdir('.test-artifacts/email-review', { recursive: true })
    await writeFile('.test-artifacts/email-review/' + slug + '.html', html)
    for (const width of [320, 390, 1200]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.setContent(html)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
      await page.screenshot({ path: '.test-artifacts/email-review/' + slug + '-' + info.project.name + '-' + width + '.png', fullPage: true })
    }
  })
}
