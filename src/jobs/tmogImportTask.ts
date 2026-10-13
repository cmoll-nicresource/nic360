import type { TaskConfig } from 'payload'

import { runTmogImportJob } from '@/lib/tmog/importJob'

/**
 * Weekly class-34 USPTO trademark import. Scheduled via `schedule` below
 * (Payload's job-queue cron); `jobs.autoRun` in payload.config.ts is what
 * actually ticks the queue and picks the scheduled job up.
 *
 * `issueDate` (YYYYMMDD) is optional input for a manual re-run of one
 * specific issue — see POST /api/trademark-reports/run-import.
 */
export const tmogImportTask: TaskConfig = {
  slug: 'import-uspto-trademarks',
  label: 'Import USPTO trademarks (class 34)',
  // Friday ~12:00 UTC: the issue for the coming Tuesday is usually posted
  // the Friday before at ~06:00 UTC, so this gives it a six-hour buffer.
  schedule: [{ cron: '0 12 * * 5', queue: 'tmog-import' }],
  inputSchema: [
    {
      name: 'issueDate',
      type: 'text',
      admin: { description: 'YYYYMMDD. Leave blank to auto-resolve the coming Tuesday (or the most recent postable issue).' },
    },
  ],
  outputSchema: [
    { name: 'issueDate', type: 'text' },
    { name: 'skipped', type: 'checkbox' },
  ],
  retries: 2,
  handler: async ({ req, input }) => {
    const issueDate = (input as { issueDate?: string } | undefined)?.issueDate || undefined
    const result = await runTmogImportJob(req.payload, issueDate)
    return { output: { issueDate: result.issueDate ?? '', skipped: !!result.skipped } }
  },
}
