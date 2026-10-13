import type { SesClient, SesSendInput, SesSendResult } from './types'

/**
 * Real AWS SES calls. Stubbed until an SES-verified sending domain and
 * Configuration Set exist — see docs/entity-map.md's Email delivery section
 * for what this needs (Easy DKIM on a dedicated subdomain, a Configuration
 * Set with Bounce/Complaint/Delivery/Open/Click event publishing to an SNS
 * topic, and SES's account-level suppression list).
 */
export function createLiveSesClient(): SesClient {
  return {
    async sendBulk(_input: SesSendInput): Promise<SesSendResult> {
      // TODO: one SendEmail (or SendBulkEmail) call per recipient via
      // @aws-sdk/client-sesv2, each tagged `{ issueId: String(input.issueId) }`
      // (read back on the event webhook to attribute opens/clicks/bounces to
      // the right PublicationIssue) and sent through the Configuration Set
      // named in SES_CONFIGURATION_SET.
      throw new Error('Live SES mode is not implemented yet. Set SES_MODE=simulated.')
    },
  }
}
