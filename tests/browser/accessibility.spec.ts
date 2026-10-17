import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import { signIn } from '../support/fixtures'

for (const path of ['/', '/login', '/signup', '/forgot-password']) {
  test('accessible public page: ' + path, async ({ page }) => {
    await page.goto(path)
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(result.violations).toEqual([])
  })
}
test('accessible gatekeeper workspace', async ({ page, context }) => {
  await signIn(context.request, 'gatekeeper')
  await page.goto('/admin')
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(result.violations).toEqual([])
})
