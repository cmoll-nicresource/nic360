import { describe, expect, it } from 'vitest'

import {
  classifyAccountEmail,
  isStuck,
  linkIsLive,
  linkLifetimeMs,
  storesMessageBody,
  stuckRecipients,
  type AccountEmailKind,
} from './accountEmailLog'

describe('classifyAccountEmail', () => {
  it('recognises every account email subject the site sends', () => {
    expect(classifyAccountEmail('Reset your Nicotine360 password')).toBe('reset')
    expect(classifyAccountEmail('Your Nicotine360 event invitation')).toBe('invitation')
    expect(classifyAccountEmail('Your Nicotine360 account is ready')).toBe('account-ready')
    expect(classifyAccountEmail('Your Nicotine360 verification code: 004201')).toBe('signup-code')
    expect(classifyAccountEmail('Confirm your Nicotine360 email address')).toBe('verification')
    expect(classifyAccountEmail('Reset your Nicotine360 staff password')).toBe('staff-reset')
  })

  it('ignores anything else, including operations alerts', () => {
    expect(classifyAccountEmail('[Nicotine360 operations] 2 items need attention')).toBeNull()
    expect(classifyAccountEmail('')).toBeNull()
    expect(classifyAccountEmail(undefined)).toBeNull()
  })
})

describe('link lifetime and body storage', () => {
  it('matches the expiry of each link', () => {
    expect(linkLifetimeMs('reset')).toBe(3_600_000)
    expect(linkLifetimeMs('signup-code')).toBe(900_000)
    expect(linkLifetimeMs('verification')).toBeNull()
  })

  it('treats a link as live only until it expires', () => {
    const sent = '2026-11-14T10:00:00.000Z'
    expect(linkIsLive('reset', sent, Date.parse('2026-11-14T10:59:00Z'))).toBe(true)
    expect(linkIsLive('reset', sent, Date.parse('2026-11-14T11:00:01Z'))).toBe(false)
    expect(linkIsLive('verification', sent, Date.parse('2026-11-14T10:01:00Z'))).toBe(false)
  })

  it('never keeps the body of a staff password reset', () => {
    expect(storesMessageBody('staff-reset')).toBe(false)
    expect(storesMessageBody('reset')).toBe(true)
  })
})

describe('stuck recipients', () => {
  const now = Date.parse('2026-11-14T12:00:00Z')
  const row = (recipient: string, createdAt: string, kind: AccountEmailKind = 'reset') => ({
    recipient,
    kind,
    createdAt,
  })

  it('needs two action messages inside a day', () => {
    expect(isStuck(1)).toBe(false)
    expect(isStuck(2)).toBe(true)
    const rows = [
      row('a@x.com', '2026-11-14T09:00:00Z'),
      row('a@x.com', '2026-11-14T10:00:00Z'),
      row('b@x.com', '2026-11-14T10:00:00Z'),
    ]
    expect(stuckRecipients(rows, {}, now).map((r) => r.email)).toEqual(['a@x.com'])
  })

  it('ignores messages older than a day and non-action mail', () => {
    const rows = [
      row('a@x.com', '2026-11-12T09:00:00Z'),
      row('a@x.com', '2026-11-14T10:00:00Z'),
      row('a@x.com', '2026-11-14T11:00:00Z', 'staff-link'),
    ]
    expect(stuckRecipients(rows, {}, now)).toEqual([])
  })

  it('drops people who signed in after the latest message', () => {
    const rows = [row('A@x.com', '2026-11-14T09:00:00Z'), row('a@x.com', '2026-11-14T10:00:00Z')]
    expect(stuckRecipients(rows, { 'a@x.com': '2026-11-14T10:30:00Z' }, now)).toEqual([])
    expect(stuckRecipients(rows, { 'a@x.com': '2026-11-14T09:30:00Z' }, now)).toHaveLength(1)
  })
})
