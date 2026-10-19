import { readFileSync } from 'node:fs'
import { expect, type Browser, type BrowserContext, type APIRequestContext } from '@playwright/test'
type Account = { id: number; email: string }
export const fixtures = JSON.parse(readFileSync('.test-artifacts/fixtures.json', 'utf8')) as {
  clipper: Record<string, { token: string; origin: string }>
  password: string
  staff: Record<string, Account>
  users: Record<string, Account>
  providers: Record<string, number>
  refs: Record<string, number>
  articles: Record<string, number>
  publications: Record<string, number>
  files: Record<string, { id: number; filename: string }>
}
export async function signIn(request: APIRequestContext, role: string) {
  const staff = fixtures.staff[role],
    account = staff ?? fixtures.users[role]
  expect(
    (
      await request.post('/api/' + (staff ? 'staff' : 'users') + '/login', {
        data: { email: account.email, password: fixtures.password },
      })
    ).status(),
  ).toBe(200)
}
export async function roleContext(browser: Browser, role: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  if (role === 'unverified') {
    const response = await ctx.request.post('/api/users/login', { data: { email: fixtures.users.unverified.email, password: fixtures.password } })
    expect([401, 403]).toContain(response.status())
  } else if (role !== 'anonymous') await signIn(ctx.request, role)
  return ctx
}
export async function capturedMail(request: APIRequestContext, email: string, kind: RegExp) {
  let found: { subject: string; html: string; text: string } | undefined
  await expect
    .poll(
      async () => {
        const messages = await (await request.get('http://127.0.0.1:2526/messages')).json()
        found = messages
          .reverse()
          .find((m: { subject: string }) => m.subject.includes(email) && kind.test(m.subject))
        return !!found
      },
      { timeout: 20000 },
    )
    .toBe(true)
  return found!
}
