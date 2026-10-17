import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signIn } from '../support/fixtures'

test('publications and guides are separate destinations, with iTrac under legislation', async ({ page }) => {
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true })
    const toggle = nav.getByRole('button', { name: 'Open navigation', exact: true })
    if (await toggle.isVisible()) await toggle.click()
    await expect(nav.getByRole('button', { name: 'Library', exact: true })).toHaveCount(0)
    await nav.getByRole('button', { name: 'Publications', exact: true }).click()
    await expect(nav.getByRole('link', { name: 'View all publications' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'View all guides' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await nav.getByRole('button', { name: 'Guides', exact: true }).click()
    await expect(nav.getByRole('link', { name: 'View all guides' })).toBeVisible()
    await page.keyboard.press('Escape')
    await nav.getByRole('button', { name: 'Legislation', exact: true }).click()
    await expect(nav.getByRole('link', { name: 'Bill library', exact: true })).toBeVisible()
    await nav.getByRole('link', { name: 'StateNet iTrac', exact: true }).click()
    await expect(page).toHaveURL(/\/bills\/itrac$/)
    await expect(page.getByRole('heading', { name: 'StateNet iTrac', exact: true })).toBeVisible()
    await expect(page.locator('iframe')).toHaveCount(0)
    const section = page.getByRole('navigation', { name: 'Legislative section', exact: true })
    await expect(section.getByRole('link', { name: 'StateNet iTrac', exact: true })).toHaveAttribute('aria-current', 'page')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1)
  }
})

test('eligible members can use the embedded portal with a new-tab fallback', async ({ page, context }) => {
  await signIn(context.request, 'base')
  let requested = false
  await page.route('https://itrac.example.invalid/**', route => {
    requested = true
    return route.fulfill({ contentType: 'text/html', body: '<html lang="en"><head><title>Synthetic iTrac</title></head><body><h1>Synthetic legislative portal</h1></body></html>' })
  })
  await page.goto('/bills/itrac')
  await expect(page.frameLocator('iframe[title="StateNet iTrac legislative portal"]').getByRole('heading', { name: 'Synthetic legislative portal' })).toBeVisible()
  expect(requested).toBe(true)
  await expect(page.getByRole('link', { name: 'Open portal in a new tab' })).toHaveAttribute('href', 'https://itrac.example.invalid/portal?key=synthetic-test-only')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
})
