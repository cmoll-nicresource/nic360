import { afterEach, describe, expect, it } from 'vitest'

import { applyEmailSafeMode, emailSafeModeRedirectAddress, isEmailSafeModeEnabled } from './emailSafeMode'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('isEmailSafeModeEnabled', () => {
  it('is on by default', () => {
    delete process.env.EMAIL_SAFE_MODE
    expect(isEmailSafeModeEnabled()).toBe(true)
  })

  it('is on for any value other than the literal "off"', () => {
    process.env.EMAIL_SAFE_MODE = 'on'
    expect(isEmailSafeModeEnabled()).toBe(true)
  })

  it('is off only when explicitly set to "off"', () => {
    process.env.EMAIL_SAFE_MODE = 'off'
    expect(isEmailSafeModeEnabled()).toBe(false)
  })
})

describe('emailSafeModeRedirectAddress', () => {
  it('defaults to the real staff admin address', () => {
    delete process.env.EMAIL_SAFE_MODE_REDIRECT_TO
    expect(emailSafeModeRedirectAddress()).toBe('cmoll@nicotineresource.org')
  })

  it('honors an override', () => {
    process.env.EMAIL_SAFE_MODE_REDIRECT_TO = 'someone-else@example.com'
    expect(emailSafeModeRedirectAddress()).toBe('someone-else@example.com')
  })
})

type FakeTransporter = { use: (step: string, plugin: (mail: { data: Record<string, unknown> }, cb: () => void) => void) => void }

describe('applyEmailSafeMode', () => {
  it('redirects to and notes the real recipient in the subject when enabled', async () => {
    process.env.EMAIL_SAFE_MODE = 'on'
    const calls: { step: string; plugin: Parameters<FakeTransporter['use']>[1] }[] = []
    const transporter: FakeTransporter = { use: (step, plugin) => calls.push({ step, plugin }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyEmailSafeMode(transporter as any)

    const mail = { data: { to: 'real.person@realcompany.com', subject: 'Your verification code' } }
    await new Promise<void>((resolve) => calls[0].plugin(mail, resolve))

    expect(mail.data.to).toBe('cmoll@nicotineresource.org')
    expect(mail.data.cc).toBeUndefined()
    expect(mail.data.bcc).toBeUndefined()
    expect(mail.data.subject).toBe('[beta safe mode — would go to: real.person@realcompany.com] Your verification code')
  })

  it('leaves the mail untouched when disabled', async () => {
    process.env.EMAIL_SAFE_MODE = 'off'
    const calls: { step: string; plugin: Parameters<FakeTransporter['use']>[1] }[] = []
    const transporter: FakeTransporter = { use: (step, plugin) => calls.push({ step, plugin }) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyEmailSafeMode(transporter as any)

    const mail = { data: { to: 'real.person@realcompany.com', subject: 'Your verification code' } }
    await new Promise<void>((resolve) => calls[0].plugin(mail, resolve))

    expect(mail.data.to).toBe('real.person@realcompany.com')
    expect(mail.data.subject).toBe('Your verification code')
  })
})
