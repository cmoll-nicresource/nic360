import type { EmailAdapter, Payload, SendEmailOptions } from 'payload'

import {
  ACTION_KINDS,
  STUCK_WINDOW_MS,
  classifyAccountEmail,
  isStuck,
  linkLifetimeMs,
  storesMessageBody,
} from './accountEmailLog'

const addresses = (value: SendEmailOptions['to']): string[] =>
  (Array.isArray(value) ? value : [value])
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : item && 'address' in item ? [String(item.address)] : []))
    .map((item) => item.replace(/^.*<([^>]+)>.*$/, '$1').trim().toLowerCase())
    .filter(Boolean)

/**
 * Wraps the account email adapter so that every recognised account email is
 * recorded in `account-emails` before it is sent, and its outcome noted after.
 * Logging is best-effort: a logging failure never blocks or alters the email.
 * The record keeps the intended recipient, even when safe mode redirects the
 * actual delivery elsewhere.
 */
export function withAccountEmailLog(adapter: Promise<EmailAdapter> | EmailAdapter): Promise<EmailAdapter> {
  return Promise.resolve(adapter).then((create) => ({ payload }: { payload: Payload }) => {
    const base = create({ payload })
    return {
      ...base,
      sendEmail: async (message: SendEmailOptions) => {
        const kind = classifyAccountEmail(message.subject)
        const recipient = addresses(message.to)[0]
        if (!kind || !recipient) return base.sendEmail(message)

        let logId: number | undefined
        try {
          const now = Date.now()
          let recent = 0
          if (ACTION_KINDS.includes(kind)) {
            const earlier = await payload.count({
              collection: 'account-emails',
              where: {
                and: [
                  { recipient: { equals: recipient } },
                  { kind: { in: ACTION_KINDS } },
                  { createdAt: { greater_than: new Date(now - STUCK_WINDOW_MS).toISOString() } },
                ],
              },
              overrideAccess: true,
            })
            recent = earlier.totalDocs
          }
          const lifetime = linkLifetimeMs(kind)
          const row = await payload.create({
            collection: 'account-emails',
            data: {
              recipient,
              kind,
              subject: String(message.subject),
              status: 'sent',
              stuck: ACTION_KINDS.includes(kind) && isStuck(recent + 1),
              linkExpiresAt: lifetime ? new Date(now + lifetime).toISOString() : undefined,
              html: storesMessageBody(kind) && typeof message.html === 'string' ? message.html : undefined,
            },
            overrideAccess: true,
          })
          logId = row.id
        } catch (error) {
          payload.logger.error({ err: error }, 'Could not record account email')
        }

        // Lets SES delivery events find this record. Only sent when an account-email
        // configuration set is configured, so unconfigured environments are unchanged.
        const configurationSet = process.env.SES_ACCOUNT_CONFIGURATION_SET
        const outgoing: SendEmailOptions =
          logId && configurationSet
            ? {
                ...message,
                headers: {
                  ...(message.headers as Record<string, string> | undefined),
                  'X-SES-CONFIGURATION-SET': configurationSet,
                  'X-SES-MESSAGE-TAGS': `accountEmailId=${logId}`,
                },
              }
            : message

        try {
          const info = (await base.sendEmail(outgoing)) as { messageId?: string } | undefined
          if (logId && info?.messageId)
            await payload
              .update({
                collection: 'account-emails',
                id: logId,
                data: { messageId: String(info.messageId).replace(/^<|@.*$|>$/g, '') },
                overrideAccess: true,
              })
              .catch(() => undefined)
          return info
        } catch (error) {
          if (logId)
            await payload
              .update({
                collection: 'account-emails',
                id: logId,
                data: {
                  status: 'failed',
                  statusAt: new Date().toISOString(),
                  error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
                },
                overrideAccess: true,
              })
              .catch(() => undefined)
          throw error
        }
      },
    }
  })
}
