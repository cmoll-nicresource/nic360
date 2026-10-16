import type { TaskConfig } from 'payload'
import { runNewsletterSend } from '@/lib/ses/sendIssue'
export const newsletterSendTask: TaskConfig = {
  slug: 'send-newsletter',
  label: 'Deliver publication newsletter',
  inputSchema: [{ name: 'issueId', type: 'number', required: true }],
  outputSchema: [],
  retries: 0,
  handler: async ({ req, input }) => {
    await runNewsletterSend(req.payload, (input as { issueId: number }).issueId)
    return { output: {} }
  },
}
