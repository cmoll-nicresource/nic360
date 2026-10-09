import type { Payload } from 'payload'

const CODE_LENGTH = 6
const CODE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += Math.floor(Math.random() * 10)
  return code
}

export function codeExpiresAt(): string {
  return new Date(Date.now() + CODE_TTL_MS).toISOString()
}

export function isCodeExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() < Date.now()
}

/** Sends the sign-up code using whatever email adapter is configured (Mandrill, or console in dev). */
export async function sendSignupCodeEmail(payload: Payload, email: string, code: string) {
  await payload.sendEmail({
    to: email,
    subject: `Your Nicotine360 verification code: ${code}`,
    html: `<p>Your verification code is:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
<p>This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`,
  })
}
