import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signIn, roleContext } from '../support/fixtures'

test('editorial header has balanced readable navigation, consistent access actions and a clean live preview', async ({ page, browser }, info) => {
  for (const width of [390, 768, 1024, 1279, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main navigation', exact: true })
    await expect(nav).toHaveCSS('height', '72px')
    const toggle = nav.getByRole('button', { name: 'Open navigation', exact: true })
    if (width < 1280) await toggle.click()
    else await expect(toggle).toBeHidden()
    const controls = nav.locator('.nav-links > a, .nav-links > .nav-dropdown > button')
    for (const control of await controls.all()) {
      await expect(control).toBeVisible()
      await expect(control).toHaveCSS('font-size', '15px')
      await expect(control).toHaveCSS('font-weight', '500')
    }
    const headerCTA = nav.getByRole('link', { name: 'Get access', exact: true })
    const heroCTA = page.locator('.edition-home-hero').getByRole('link', { name: 'Get access', exact: true })
    expect(await headerCTA.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(await heroCTA.evaluate(el => getComputedStyle(el).backgroundColor))
    if (width < 1280) await nav.getByRole('button', { name: 'Close navigation', exact: true }).click()
    await expect(page.locator('.edition-product-window')).toHaveCSS('transform', 'none')
    await expect(page.locator('.edition-window-chrome, .edition-product-data-lines')).toHaveCount(0)
    const dates = page.locator('.edition-home-news .edition-news-row time')
    expect(await dates.count()).toBeGreaterThan(0)
    for (const date of await dates.all()) await expect(date).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    if ([390, 1280, 1440].includes(width)) await page.screenshot({ path: `.test-artifacts/home-header-${info.project.name}-${width}.png` })
  }
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  for (const role of ['admin', 'base']) {
    const context = await roleContext(browser, role)
    try {
      const signedIn = await context.newPage()
      await signedIn.setViewportSize({ width: 1280, height: 900 })
      await signedIn.goto(role === 'base' ? '/dashboard' : '/')
      const nav = signedIn.getByRole('navigation', { name: 'Main navigation', exact: true })
      await expect(nav).toHaveCSS('height', '72px')
      const bounds = await nav.boundingBox()
      for (const control of await nav.locator('.nav-links > a, .nav-links > .nav-dropdown > button').all()) {
        const box = await control.boundingBox()
        expect(box!.y).toBeGreaterThanOrEqual(bounds!.y - 1)
        expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1)
      }
      expect(await signedIn.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    } finally { await context.close() }
  }
})

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

test('eligible subscribers can use the embedded portal with a new-tab fallback', async ({ page, context }) => {
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
