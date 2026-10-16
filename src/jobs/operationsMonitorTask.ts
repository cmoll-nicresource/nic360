import type { TaskConfig } from 'payload'
import { runOperationalMonitor } from '@/lib/operations/monitor'

export const operationsMonitorTask: TaskConfig = {
  slug: 'monitor-operations',
  label: 'Check publication and import operations',
  schedule: [{ cron: '*/5 * * * *', queue: 'operations' }],
  inputSchema: [],
  outputSchema: [],
  retries: 0,
  handler: async ({ req }) => {
    await runOperationalMonitor(req.payload)
    return { output: {} }
  },
}
