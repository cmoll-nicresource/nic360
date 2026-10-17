import { test, expect } from '@playwright/test'
import { fixtures as f, signIn } from '../support/fixtures'
test('daily editor workflow: excerpt, dated issue, build and unsent preview', async ({
  page,
  context,
}, info) => {
  await signIn(context.request, 'editor')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Editorial desk', level: 1 })).toBeVisible()
  await page.locator('a.nic-workspace__task').filter({hasText:'Add a news excerpt'}).click()
  await page
    .locator('#field-title')
    .fill('Browser draft ' + info.project.name + ' ' + crypto.randomUUID())
  await page
    .locator('[contenteditable="true"]')
    .first()
    .fill('Synthetic browser-entered full excerpt, distinct from the headline.')
  await page.getByRole('button', { name: /^Save Draft$/i }).click()
  await page.waitForURL(/\/admin\/collections\/articles\/\d+/)
  const articleId = page.url().split('/').pop()!,
    article = await (await context.request.get('/api/articles/' + articleId + '?draft=true')).json()
  expect(JSON.stringify(article.excerpt)).toContain('browser-entered full excerpt')
  await page.goto('/admin/collections/publication-issues/create')
  const combo = page.getByRole('combobox').first()
  await combo.fill('US News Clippings')
  await page.getByText('US News Clippings', { exact: true }).last().click()
  const date = page.locator('.date-time-field input').first()
  await date.fill('10/16/2090')
  await date.press('Enter')
  await date.press('Tab')
  await expect(page.locator('#field-title')).toHaveValue('US News Clippings - October 16, 2090')
  await page.getByRole('button', { name: /^Save Draft$/i }).click()
  await page.waitForURL(/\/admin\/collections\/publication-issues\/\d+/)
  await page.getByRole('button', { name: 'Build from rules', exact: true }).click()
  await expect(page.getByText(/Built .*Reloading/)).toBeVisible()
  await page.waitForLoadState('networkidle')
  const issueId = page.url().split('/').pop()!,
    issue = await (
      await context.request.get('/api/publication-issues/' + issueId + '?draft=true&depth=0')
    ).json(),
    ids = issue.sections
      .flatMap((s: { items: { value: number }[] }) => s.items.map((i) => i.value))
      .sort((a: number, b: number) => a - b)
  expect(ids).toEqual(
    [f.articles.us, f.articles.mixed, f.articles.state, f.articles.usVapor].sort((a, b) => a - b),
  )
  await page.reload()
  await page.getByRole('button', { name: 'Preview issue', exact: true }).click()
  const preview = page.frameLocator('iframe[title="Publication email preview"]')
  await expect(
    preview.getByRole('heading', { name: 'US News Clippings', exact: true }),
  ).toBeVisible()
  await expect(preview.getByText(/Synthetic full excerpt for us\./)).toBeVisible()
  await expect(preview.getByRole('heading', { name: 'Fixture china', exact: true })).toHaveCount(0)
  expect(issue._status).toBe('draft')
  expect(issue.email.status).toBe('not sent')
})
for (const role of ['gatekeeper', 'admin'])
  test('role workspace and taxonomy boundaries: ' + role, async ({ page, context }) => {
    await signIn(context.request, role)
    await page.goto('/admin')
    await expect(
      page.getByRole('heading', {
        name: role === 'admin' ? 'Administration workspace' : 'Membership & events',
        level: 1,
      }),
    ).toBeVisible()
    if (role === 'gatekeeper') {
      await expect(page.getByRole('link', { name: /Add a news excerpt/ })).toHaveCount(0)
      await expect(page.locator('a.nic-workspace__task').filter({hasText:'Manage subscriptions'})).toBeVisible()
    }
    const response=await page.goto('/admin/collections/subjects')
    if (role === 'admin')
      await expect(page.getByRole('heading', { name: 'Subjects', exact: true })).toBeVisible()
    else expect(response?.status()).toBe(404)
    await page.goto('/admin/account')
    await expect(page.locator('#field-email')).toHaveValue(f.staff[role].email)
  })
test('configured clippings select the right fixtures after the migration repair', async ({
  context,
}) => {
  await signIn(context.request, 'editor')
  for (const [slug, expected] of [
    ['global-news-clippings', [f.articles.china, f.articles.mixed, f.articles.ukVapor]],
    ['vapor-news-clippings', [f.articles.usVapor, f.articles.ukVapor]],
  ] as const) {
    const create = await context.request.post('/api/publication-issues', {
      data: {
        publication: f.publications[slug],
        issueDate: '2090-10-16T12:00:00Z',
        format: 'excerpt-list',
        _status: 'draft',
      },
    })
    expect(create.status()).toBe(201)
    const id = (await create.json()).doc.id
    const build = await context.request.post('/api/publication-issues/' + id + '/build-from-rules')
    expect(build.status()).toBe(200)
    const issue = (await build.json()).issue
    expect(
      issue.sections
        .flatMap((s: { items: { relationTo: string; value: number }[] }) =>
          s.items.map((i) => {
            expect(i.relationTo).toBe('articles')
              return typeof i.value==='object'?(i.value as {id:number}).id:i.value
          }),
        )
        .sort((a: number, b: number) => a - b),
    ).toEqual([...expected].sort((a, b) => a - b))
  }
})
