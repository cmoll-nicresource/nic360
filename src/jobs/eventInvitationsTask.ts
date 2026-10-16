import type { TaskConfig } from 'payload'
import { sendOrderInvitations } from '@/lib/orderFulfillment'

export const eventInvitationsTask: TaskConfig = {
  slug: 'invite-event-attendees',
  label: 'Invite event colleagues',
  inputSchema: [{ name: 'orderId', type: 'number', required: true }],
  outputSchema: [],
  retries: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  handler: async ({ req, input }) => {
    await sendOrderInvitations(req.payload, (input as { orderId: number }).orderId)
    return { output: {} }
  },
}
