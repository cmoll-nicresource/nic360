import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { Staff } from '@/collections/Staff'
import { Users } from '@/collections/Users'
import { accountSiteUrl, accountVerificationEmail, passwordResetEmail, signupCodeEmail } from './accountEmail'
import { sendSignupCodeEmail } from './signupCode'

beforeEach(() => vi.stubEnv('SITE_URL', 'https://beta.nicotine360.org/'))
afterEach(() => vi.unstubAllEnvs())

function resetGenerator(collection: typeof Staff) {
  const auth = collection.auth
  if (!auth || typeof auth !== 'object' || !auth.forgotPassword?.generateEmailHTML)
    throw new Error('A custom reset email must be configured.')
  return auth.forgotPassword.generateEmailHTML
}

describe('account email delivery contracts', () => {
  it('wires staff recovery to a branded absolute admin reset link, even without request origin', async () => {
    const html = await resetGenerator(Staff)({ token: 'staff-token', user: { name: 'Staff' } })
    expect(html).toContain('https://beta.nicotine360.org/admin/reset/staff-token')
    expect(html).toContain('Nicotine360 staff account')
    expect(html).toContain('expires in one hour')
    expect(html).toContain('alt="Nicotine360"')
    expect(html).not.toContain('href="/admin/reset/')
  })

  it('keeps website resets on the frontend and ignores untrusted request hosts', async () => {
    const req = { context: {}, headers: new Headers({ host: 'attacker.invalid', origin: 'https://attacker.invalid' }) } as PayloadRequest
    const html = await resetGenerator(Users)({ token: 'user-token', req, user: { firstName: 'A <B>' } })
    expect(html).toContain('https://beta.nicotine360.org/reset-password/user-token')
    expect(html).not.toContain('/admin/reset/')
    expect(html).not.toContain('attacker.invalid')
    expect(html).toContain('A &lt;B&gt;')
    expect(html).toContain('subscription or publication email preferences')
  })

  it('uses invitation language for event registration rather than an unsolicited reset request', async () => {
    const req = { context: { eventInvitation: true }, headers: new Headers() } as unknown as PayloadRequest
    const html = await resetGenerator(Users)({ token: 'invite-token', req })
    expect(html).toContain('Your event registration is ready')
    expect(html).toContain('Set your password')
    expect(html).toContain('/reset-password/invite-token')
    expect(html).not.toContain('We received a request to reset')
  })

  it('sends signup codes through the shared design without changing the code or subject contract', async () => {
    const sendEmail = vi.fn().mockResolvedValue({})
    await sendSignupCodeEmail({ sendEmail } as unknown as Payload, 'synthetic@example.invalid', '004201')
    const mail = sendEmail.mock.calls[0][0]
    expect(mail.subject).toBe('Your Nicotine360 verification code: 004201')
    expect(mail.html).toContain('004201')
    expect(mail.html).toContain('expires in 15 minutes')
    expect(mail.html).toContain('Enter this code on the signup screen')
  })

  it('also brands Payload-native user email verification with an absolute URL', async () => {
    const auth = Users.auth
    if (!auth || typeof auth !== 'object' || typeof auth.verify !== 'object' || !auth.verify.generateEmailHTML)
      throw new Error('Verification email must be configured.')
    const html = await auth.verify.generateEmailHTML({ token: 'verify-token', user: {}, req: {} as PayloadRequest })
    expect(html).toContain('https://beta.nicotine360.org/admin/users/verify/verify-token')
    expect(html).toContain('Confirm email address')
  })
})

describe('safe, self-contained account email markup', () => {
  it('uses absolute links and image URLs in every account email variant', () => {
    for (const html of [passwordResetEmail({ token: 'reset' }), passwordResetEmail({ token: 'staff', staff: true }), passwordResetEmail({ token: 'invite', invitation: true }), signupCodeEmail('123456'), accountVerificationEmail('verify')]) {
      const urls = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1])
      expect(urls.length).toBeGreaterThan(3)
      for (const url of urls) expect(url).toMatch(/^(https:\/\/beta\.nicotine360\.org\/|mailto:)/)
      expect(html).toContain('role="presentation"')
    }
  })

  it('encodes tokens and escapes names rather than allowing injected markup', () => {
    const html = passwordResetEmail({ token: 'token/"<x>?', name: '<img src=x onerror=alert(1)>' })
    expect(html).toContain('token%2F%22%3Cx%3E%3F')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
    expect(() => passwordResetEmail({})).toThrow('token is required')
    expect(() => signupCodeEmail('<script>')).toThrow('six-digit')
  })

  it('rejects relative and non-web origins instead of emitting broken or unsafe links', () => {
    for (const origin of ['/relative', 'javascript:alert(1)', 'https://user:password@example.invalid']) {
      vi.stubEnv('SITE_URL', origin)
      expect(() => accountSiteUrl()).toThrow()
    }
    vi.stubEnv('SITE_URL', 'http://127.0.0.1:3100/')
    expect(passwordResetEmail({ token: 'local' })).toContain('http://127.0.0.1:3100/reset-password/local')
  })
})
