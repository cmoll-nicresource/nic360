import type { Transporter } from 'nodemailer'

/**
 * Real customer data is live in this environment (the full migrated user
 * base), so every outgoing account email needs a hard safety net against
 * accidentally emailing someone real who never asked to hear from this
 * beta. Safe by default: requires an explicit EMAIL_SAFE_MODE=off to send
 * to real recipients at all, rather than requiring something be turned on.
 *
 * Works as a nodemailer "compile" plugin (https://nodemailer.com/plugins/),
 * so it applies uniformly to any transport (SES, SMTP, the console
 * fallback) without each call site needing to know about it.
 */
export function isEmailSafeModeEnabled(): boolean {
  return process.env.EMAIL_SAFE_MODE !== 'off'
}

const DEFAULT_REDIRECT_TO = 'demo@nicotine360.org'

export function emailSafeModeRedirectAddress(): string {
  return process.env.EMAIL_SAFE_MODE_REDIRECT_TO || DEFAULT_REDIRECT_TO
}

/** Mutates the compiled mail's `to`/`cc`/`bcc` in place and notes the real recipient(s) in the subject. */
export function applyEmailSafeMode(transporter: Transporter): void {
  transporter.use('compile', (mail, callback) => {
    if (!isEmailSafeModeEnabled()) {
      callback()
      return
    }
    const data = mail.data
    const realRecipients = [data.to, data.cc, data.bcc]
      .flat()
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
    data.to = emailSafeModeRedirectAddress()
    data.cc = undefined
    data.bcc = undefined
    data.subject = `[beta safe mode — would go to: ${realRecipients.join(', ') || '(unknown)'}] ${data.subject ?? ''}`
    callback()
  })
}
