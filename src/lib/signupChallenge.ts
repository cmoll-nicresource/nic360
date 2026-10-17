import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
type Challenge = { hash: string; attempts: number }
export function signupChallenge(code: string) {
  return JSON.stringify({ hash: hash(code), attempts: 0 })
}
export function checkSignupCode(stored: string | undefined | null, code: string) {
  let challenge: Challenge
  try {
    challenge = JSON.parse(stored ?? '') as Challenge
  } catch {
    return { valid: false, next: null }
  }
  if (
    !/^[a-f0-9]{64}$/.test(challenge.hash ?? '') ||
    !Number.isInteger(challenge.attempts) ||
    challenge.attempts >= 5
  )
    return { valid: false, next: null }
  const valid =
    /^\d{6}$/.test(code) &&
    timingSafeEqual(Buffer.from(hash(code), 'hex'), Buffer.from(challenge.hash, 'hex'))
  return { valid, next: JSON.stringify({ ...challenge, attempts: challenge.attempts + 1 }) }
}
export function signupCompletionProof() {
  const token = randomBytes(32).toString('hex')
  return { token, stored: 'verified:' + hash(token) }
}
export function validSignupProof(stored: string | null | undefined, token: string | undefined) {
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !stored?.startsWith('verified:')) return false
  const expected = stored.slice(9)
  return (
    /^[a-f0-9]{64}$/.test(expected) &&
    timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(hash(token), 'hex'))
  )
}
export const SIGNUP_COOKIE = 'nic360-signup-proof'
export function signupCookie(request: Request) {
  return (request.headers.get('cookie') ?? '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(SIGNUP_COOKIE + '='))
    ?.slice(SIGNUP_COOKIE.length + 1)
}
