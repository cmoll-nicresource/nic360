import { expect, it } from 'vitest'
import { latestLegacyLogin, legacyLoginDate, normalizeLoginEmail } from './legacyUserLogins'

it('interprets naive legacy timestamps as UTC and keeps CMS millisecond precision', () => {
  expect(legacyLoginDate('2026-10-13 14:22:33.123456')).toBe('2026-10-13T14:22:33.123Z')
  expect(legacyLoginDate('2026-03-08 02:30:00')).toBe('2026-03-08T02:30:00.000Z')
})
it('does not manufacture logins from missing, invalid, out-of-range or future dates', () => {
  for (const value of [undefined, '\\N', '', '2026-02-30 12:00:00', 'garbage', '0015-01-01 00:00:00', '2099-01-01 00:00:00'])
    expect(legacyLoginDate(value, new Date('2026-10-18T12:00:00Z'))).toBeNull()
})
it('uses exact normalized email matching without merging aliases', () => {
  expect(normalizeLoginEmail(' Reader+News@Example.invalid ')).toBe('reader+news@example.invalid')
})
it('prefers the most recent valid sign-in and falls back when one legacy field is missing', () => {
  expect(latestLegacyLogin('2026-10-13 12:00:00', '2026-09-01 12:00:00')).toBe('2026-10-13T12:00:00.000Z')
  expect(latestLegacyLogin('\\N', '2026-09-01 12:00:00')).toBe('2026-09-01T12:00:00.000Z')
  expect(latestLegacyLogin('2026-09-01 12:00:00', '2026-10-13 12:00:00')).toBe('2026-10-13T12:00:00.000Z')
  expect(latestLegacyLogin('\\N', '\\N')).toBeUndefined()
})
