import type {
  MailchimpCampaign,
  MailchimpClient,
  MailchimpMemberUpdate,
  MailchimpSendResult,
} from './types'
import { parseMailchimpWebhookBody } from './simulated'

/** Real Mailchimp Marketing API calls. Stubbed until a test audience exists — see CLAUDE.md. */
export function createLiveMailchimpClient(): MailchimpClient {
  return {
    async upsertMember(_update: MailchimpMemberUpdate) {
      // TODO: PUT /lists/{audienceId}/members/{subscriberHash} via the Mailchimp Marketing API.
      throw new Error('Live Mailchimp mode is not implemented yet. Set MAILCHIMP_MODE=simulated.')
    },

    async createCampaign(_campaign: MailchimpCampaign): Promise<MailchimpSendResult> {
      // TODO: POST /campaigns, then PUT /campaigns/{id}/content.
      throw new Error('Live Mailchimp mode is not implemented yet. Set MAILCHIMP_MODE=simulated.')
    },

    async sendCampaign(_campaignId: string) {
      // TODO: POST /campaigns/{id}/actions/send.
      throw new Error('Live Mailchimp mode is not implemented yet. Set MAILCHIMP_MODE=simulated.')
    },

    async sendTest(_campaign: MailchimpCampaign, _testEmail: string) {
      // TODO: POST /campaigns/{id}/actions/test.
      throw new Error('Live Mailchimp mode is not implemented yet. Set MAILCHIMP_MODE=simulated.')
    },

    parseUnsubscribeWebhook: parseMailchimpWebhookBody,
  }
}
