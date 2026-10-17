import { SendRawEmailCommand, SESClient } from '@aws-sdk/client-ses'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

import { applyEmailSafeMode } from './emailSafeMode'
import { consoleEmailTransport } from './consoleEmailTransport'
import { assertTestIsolation } from './testIsolation'

/**
 * Builds the transport used for account email (verification, password
 * reset, event invites — via Payload's nodemailer email adapter in
 * payload.config.ts). Pulled out of payload.config.ts so this wiring is
 * unit-testable: accountEmailTransport.test.ts asserts safe mode is always
 * applied, so a future edit that drops the applyEmailSafeMode() call here
 * fails a test instead of silently emailing real migrated users from a
 * beta/dev environment.
 */
export function buildAccountEmailTransport(): Transporter {
  if (process.env.E2E_SMTP_URL) {
    assertTestIsolation()
    const smtp = new URL(process.env.E2E_SMTP_URL)
    if (!['localhost', '127.0.0.1'].includes(smtp.hostname))
      throw new Error('Test SMTP must be loopback-only.')
    const transport = nodemailer.createTransport(process.env.E2E_SMTP_URL)
    applyEmailSafeMode(transport)
    return transport
  }
  const hasSesConfig = Boolean(process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY)

  const transport = hasSesConfig
    ? nodemailer.createTransport(
        // @types/nodemailer's createTransport overloads don't cover the
        // {SES: {...}} shorthand (it has no dependency on @aws-sdk/client-ses
        // types) — this is still real, documented nodemailer behavior:
        // https://nodemailer.com/transports/ses/
        {
          SES: {
            ses: new SESClient({
              region: process.env.SES_REGION || 'us-east-1',
              credentials: {
                accessKeyId: process.env.SES_ACCESS_KEY_ID!,
                secretAccessKey: process.env.SES_SECRET_ACCESS_KEY!,
              },
            }),
            aws: { SendRawEmailCommand },
          },
        } as Parameters<typeof nodemailer.createTransport>[0],
      )
    : // No SES_* env set: print emails to the console instead of sending them.
      nodemailer.createTransport(consoleEmailTransport)

  // Real migrated user data lives in non-local environments — this is the
  // hard safety net against ever emailing one of them by accident. See
  // emailSafeMode.ts; requires an explicit EMAIL_SAFE_MODE=off to actually
  // deliver to a real recipient.
  applyEmailSafeMode(transport)

  return transport
}
