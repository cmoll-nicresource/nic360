import type { Payload } from 'payload'

import type { SesClient } from './types'
import { createLiveSesClient } from './live'
import { createSimulatedSesClient } from './simulated'

export type { SesEvent, SesEventType, SesClient, SesRecipient, SesSendInput, SesSendResult } from './types'
export { parseSesEvent } from './parseEvents'

export function getSesClient(payload: Payload): SesClient {
  const mode = process.env.SES_MODE === 'live' ? 'live' : 'simulated'
  return mode === 'live' ? createLiveSesClient() : createSimulatedSesClient(payload)
}
