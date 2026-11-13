import { test, expect } from '@playwright/test'
import { fixtures as f, roleContext, signIn } from '../support/fixtures'

test('provider merge rejects non-admin accounts, including gatekeepers', async ({ browser }) => {
  for (const role of ['anonymous', 'premium', 'editor', 'gatekeeper']) {
    const context = await roleContext(browser, role)
    try {
      const response = await context.request.post('/api/admin/access-providers/merge', { data: { action: 'preview', sourceId: f.providers.base, targetId: f.providers.premium } })
      expect(response.status()).toBe(403)
      if (role === 'gatekeeper') {
        const page = await context.newPage()
        await page.goto(`/admin/collections/access-providers/${f.providers.base}`)
        await page.waitForLoadState('networkidle')
        await expect(page.getByLabel('Company name')).toBeVisible()
        await expect(page.getByRole('region', { name: 'Merge access provider' })).toHaveCount(0)
      }
    } finally { await context.close() }
  }
})

test('admin previews and confirms a merge in the provider edit screen', async ({ page }) => {
  await signIn(page.request, 'admin')
  const suffix = crypto.randomUUID().slice(0, 8)
  const add = async (name: string, plan: string, domain: string) => {
    const response = await page.request.post('/api/access-providers', { data: { name, plan, status: 'live', ...(plan === 'premium' ? { licenseExpiresAt: '2027-12-31T00:00:00Z' } : {}), allowedDomains: [{ domain }] } })
    expect(response.status()).toBe(201)
    return (await response.json()).doc
  }
  const source = await add(`Merge branch ${suffix}`, 'base', 'branch.example.invalid')
  const target = await add(`Merge parent ${suffix}`, 'premium', 'parent.example.invalid')
  const original = await (await page.request.get(`/api/users/${f.users.base.id}?depth=0`)).json()
  let merged = false
  try {
    expect((await page.request.patch(`/api/users/${f.users.base.id}`, { data: { accessProvider: source.id } })).status()).toBe(200)
    await page.goto(`/admin/collections/access-providers/${source.id}`)
    await page.waitForLoadState('networkidle')
    const panel = page.getByRole('region', { name: 'Merge access provider' })
    await panel.getByRole('button', { name: 'Merge into another provider…' }).click()
    await panel.getByLabel('Find the provider to keep').fill(target.name)
    await panel.getByRole('button', { name: `${target.name} (#${target.id})`, exact: true }).click()
    await panel.getByRole('button', { name: 'Preview merge', exact: true }).click()
    await expect(panel.getByRole('heading', { name: 'Review the merge' })).toBeVisible()
    await expect(panel).toContainText('1 user')
    await expect(panel).toContainText('branch.example.invalid')
    await expect(panel).toContainText('2027')
    const merge = panel.getByRole('button', { name: `Merge into ${target.name}`, exact: true })
    await expect(merge).toBeDisabled()
    await page.screenshot({ path: `.test-artifacts/provider-merge-${suffix}.png`, fullPage: true })
    await panel.getByRole('checkbox').check()
    await merge.click()
    await expect(page).toHaveURL(new RegExp(`/access-providers/${target.id}$`))
    merged = true
    const user = await (await page.request.get(`/api/users/${f.users.base.id}?depth=0`)).json()
    expect(user.accessProvider).toBe(target.id)
    expect(user.emailPublications).toEqual(original.emailPublications)
    expect(user.status).toBe(original.status)
    expect(user._verified).toBe(original._verified)
    const survivor = await (await page.request.get(`/api/access-providers/${target.id}?depth=0`)).json()
    expect(survivor.plan).toBe('premium')
    expect(survivor.allowedDomains.map((d: { domain: string }) => d.domain).sort()).toEqual(['branch.example.invalid', 'parent.example.invalid'])
    expect((await page.request.get(`/api/access-providers/${source.id}`)).status()).toBe(404)
  } finally {
    await page.request.patch(`/api/users/${f.users.base.id}`, { data: { accessProvider: original.accessProvider } })
    if (!merged) await page.request.delete(`/api/access-providers/${source.id}`)
    await page.request.delete(`/api/access-providers/${target.id}`)
  }
})
