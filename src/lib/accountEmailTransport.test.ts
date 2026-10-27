import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildAccountEmailTransport } from './accountEmailTransport'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  // No SES_* set, so this exercises the console transport path — no real
  // network call either way, since safe mode intercepts before send.
  delete process.env.EMAIL_SAFE_MODE_REDIRECT_TO
  delete process.env.SES_ACCESS_KEY_ID
  delete process.env.SES_SECRET_ACCESS_KEY
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

/**
 * Regression test for the safety wiring itself, not just the policy logic
 * (already covered by emailSafeMode.test.ts). If a future edit to
 * accountEmailTransport.ts drops the applyEmailSafeMode() call, this fails
 * instead of silently letting real migrated users get emailed from a
 * beta/dev environment.
 */
describe('buildAccountEmailTransport', () => {
  it('redirects a real recipient by default (EMAIL_SAFE_MODE unset)', async () => {
    delete process.env.EMAIL_SAFE_MODE
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const transport = buildAccountEmailTransport()
    await new Promise<void>((resolve, reject) => {
      transport.sendMail(
        { to: 'real.person@realcompany.com', subject: 'Your verification code', html: '<p>hi</p>' },
        (err) => (err ? reject(err) : resolve()),
      )
    })

    const logged = logSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    // Redirected to the safe address; the real recipient is only noted in
    // the subject line (by design — see emailSafeMode.ts), not delivered to.
    expect(logged).toContain('To: demo@nicotine360.org')
    expect(logged).toContain('would go to: real.person@realcompany.com')
  })

  it('still redirects when EMAIL_SAFE_MODE is set to anything other than "off"', async () => {
    process.env.EMAIL_SAFE_MODE = 'on'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const transport = buildAccountEmailTransport()
    await new Promise<void>((resolve, reject) => {
      transport.sendMail(
        { to: 'real.person@realcompany.com', subject: 'Your verification code', html: '<p>hi</p>' },
        (err) => (err ? reject(err) : resolve()),
      )
    })

    const logged = logSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(logged).toContain('To: demo@nicotine360.org')
  })

  it('only delivers to the real recipient with an explicit EMAIL_SAFE_MODE=off', async () => {
    process.env.EMAIL_SAFE_MODE = 'off'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const transport = buildAccountEmailTransport()
    await new Promise<void>((resolve, reject) => {
      transport.sendMail(
        { to: 'real.person@realcompany.com', subject: 'Your verification code', html: '<p>hi</p>' },
        (err) => (err ? reject(err) : resolve()),
      )
    })

    const logged = logSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(logged).toContain('To: real.person@realcompany.com')
  })
})
