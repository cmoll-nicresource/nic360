import type { Payload } from 'payload'
import { randomInt } from 'node:crypto'
import { signupCodeEmail } from './accountEmail'

const CODE_LENGTH = 6
const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function generateCode(): string {
  return String(randomInt(10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')
}

export function codeExpiresAt(): string {
  return new Date(Date.now() + CODE_TTL_MS).toISOString()
}

export function isCodeExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true
  const time = new Date(expiresAt).getTime()
  return !Number.isFinite(time) || time <= Date.now()
}

/** Uses the configured account transport and its beta recipient safety rules. */
export async function sendSignupCodeEmail(payload: Payload, email: string, code: string) {
  await payload.sendEmail({
    to: email,
    subject: `Your Nicotine360 verification code: ${code}`,
    html: signupCodeEmail(code),
  })
}
