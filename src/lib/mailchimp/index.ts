import type { Payload } from 'payload'

import type { MailchimpClient } from './types'
import { createLiveMailchimpClient } from './live'
import { createSimulatedMailchimpClient } from './simulated'

export type { MailchimpCampaign, MailchimpClient, MailchimpMemberUpdate, MailchimpUnsubscribeEvent } from './types'

export function getMailchimpClient(payload: Payload): MailchimpClient {
  const mode = process.env.MAILCHIMP_MODE === 'live' ? 'live' : 'simulated'
  return mode === 'live' ? createLiveMailchimpClient() : createSimulatedMailchimpClient(payload)
}
