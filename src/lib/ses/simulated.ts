import type { Payload } from 'payload'

import type { SesClient, SesSendInput, SesSendResult } from './types'

/**
 * No AWS account configured yet. Writes every bulk send to the ses-outbox
 * collection instead of calling the real API — same philosophy as
 * src/lib/mailchimp/simulated.ts.
 */
export function createSimulatedSesClient(payload: Payload): SesClient {
  return {
    async sendBulk(input: SesSendInput): Promise<SesSendResult> {
      await payload.create({
        collection: 'ses-outbox',
        data: {
          issue: input.issueId,
          subject: input.subject,
          recipientCount: input.recipients.length,
          html: input.html,
        },
        overrideAccess: true,
      })
      return { messageCount: input.recipients.length }
    },
  }
}
