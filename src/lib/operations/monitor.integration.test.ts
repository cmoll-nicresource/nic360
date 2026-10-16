import 'dotenv/config'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { collectOperationalConditions, runOperationalMonitor } from './monitor'

describe.skipIf(process.env.OPERATIONS_INTEGRATION !== '1')(
  'operations monitoring on disposable PostgreSQL',
  () => {
    let payload: Payload
    const sendEmail = vi.fn()
    const find = vi.fn()
    const now = new Date('2099-01-01T12:00:00Z')
    const failedIssue = {
      id: 960001,
      title: 'Monitor fixture',
      updatedAt: now.toISOString(),
      email: { status: 'failed' },
    }
    const fixture = () => ({ ...payload, find, sendEmail }) as unknown as Payload
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URI || '')
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        !url.pathname.includes('_test')
      )
        throw new Error('Operations tests require a disposable loopback _test database.')
      vi.stubEnv('SES_ACCESS_KEY_ID', '')
      vi.stubEnv('SES_SECRET_ACCESS_KEY', '')
      const { getPayload } = await import('payload')
      const { default: config } = await import('@/payload.config')
      const resolved = await config
      resolved.jobs!.autoRun = []
      payload = await getPayload({ config: resolved })
    }, 60000)
    beforeEach(async () => {
      vi.stubEnv('OPERATIONS_MONITOR_ENABLED', 'true')
      vi.stubEnv('OPERATIONS_MONITOR_SINCE', '2099-01-01T00:00:00Z')
      vi.stubEnv('OPERATIONS_ALERT_EMAIL', 'staff@example.invalid')
      find.mockReset()
      sendEmail.mockReset().mockResolvedValue({})
      find.mockImplementation(async ({ collection }) => ({
        docs: collection === 'publication-issues' ? [failedIssue] : [],
        hasNextPage: false,
      }))
      await payload.db.pool.query('DELETE FROM operational_alerts')
    })
    afterAll(async () => {
      await payload?.destroy()
      vi.unstubAllEnvs()
    })
    it('persists one alert and one digest under concurrent scans, then resolves and reopens', async () => {
      await Promise.all([
        runOperationalMonitor(fixture(), now),
        runOperationalMonitor(fixture(), now),
      ])
      await runOperationalMonitor(fixture(), now)
      expect(sendEmail).toHaveBeenCalledTimes(1)
      expect(sendEmail.mock.calls[0][0].to).toBe('staff@example.invalid')
      const result = await payload.find({ collection: 'operational-alerts', depth: 0 })
      expect(result.docs).toHaveLength(1)
      expect(result.docs[0].resolved).toBe(false)
      expect(result.docs[0].notifiedAt).toBeTruthy()
      find.mockResolvedValue({ docs: [], hasNextPage: false })
      await runOperationalMonitor(fixture(), now)
      expect(
        (await payload.findByID({ collection: 'operational-alerts', id: result.docs[0].id }))
          .resolved,
      ).toBe(true)
      find.mockImplementation(async ({ collection }) => ({
        docs: collection === 'publication-issues' ? [failedIssue] : [],
        hasNextPage: false,
      }))
      await runOperationalMonitor(fixture(), now)
      expect(sendEmail).toHaveBeenCalledTimes(2)
    })
    it('retains notification failures and throttles retries for an hour', async () => {
      sendEmail.mockRejectedValue(new Error('transport unavailable'))
      await runOperationalMonitor(fixture(), now)
      const alert = (await payload.find({ collection: 'operational-alerts' })).docs[0]
      expect(alert.notificationError).toContain('failed')
      expect(alert.notifiedAt).toBeNull()
      await runOperationalMonitor(fixture(), new Date(now.getTime() + 5 * 60_000))
      expect(sendEmail).toHaveBeenCalledTimes(1)
      sendEmail.mockResolvedValue({})
      await runOperationalMonitor(fixture(), new Date(now.getTime() + 61 * 60_000))
      expect(sendEmail).toHaveBeenCalledTimes(2)
    })
    it('does not resolve existing alerts when a source scan fails', async () => {
      await runOperationalMonitor(fixture(), now)
      find.mockRejectedValue(new Error('database unavailable'))
      await expect(runOperationalMonitor(fixture(), now)).rejects.toThrow('database unavailable')
      expect((await payload.find({ collection: 'operational-alerts' })).docs[0].resolved).toBe(
        false,
      )
    })
    it('does not alarm on a long send whose real worker lock is held', async () => {
      find.mockImplementation(async ({ collection }) => ({
        docs:
          collection === 'publication-issues'
            ? [{ ...failedIssue, updatedAt: '2099-01-01T10:00:00Z', email: { status: 'sending' } }]
            : [],
        hasNextPage: false,
      }))
      const worker = await payload.db.pool.connect()
      try {
        await worker.query('SELECT pg_advisory_lock(36031,$1)', [failedIssue.id])
        expect(await collectOperationalConditions(fixture(), new Date('2099-01-01'), now)).toEqual(
          [],
        )
        await worker.query('SELECT pg_advisory_unlock(36031,$1)', [failedIssue.id])
        expect(
          await collectOperationalConditions(fixture(), new Date('2099-01-01'), now),
        ).toHaveLength(1)
      } finally {
        worker.release()
      }
    })
    it('checks missing Friday imports and tolerates a zero-activity Gazette without a PDF', async () => {
      const friday = new Date('2099-01-02T17:00:00Z')
      find.mockResolvedValue({ docs: [], hasNextPage: false })
      const missing = await collectOperationalConditions(fixture(), new Date('2099-01-01'), friday)
      expect(missing.map((c) => c.key)).toEqual(['gazette-missing:20990106'])
      find.mockImplementation(async ({ collection, where }) => ({
        docs:
          collection === 'trademark-import-runs' && where.and
            ? [{ id: 1, counts: { published: 0 } }]
            : [],
        hasNextPage: false,
      }))
      expect(await collectOperationalConditions(fixture(), new Date('2099-01-01'), friday)).toEqual(
        [],
      )
    })
    it('finds missing report PDFs and accepts a separately regenerated weekly issue', async () => {
      const friday = new Date('2099-01-02T17:00:00Z')
      find.mockImplementation(async ({ collection, where }) => ({
        docs:
          collection === 'trademark-import-runs' && where.and
            ? [{ id: 1, counts: { published: 2 } }]
            : collection === 'publications'
              ? [{ id: 8 }]
              : [],
        hasNextPage: false,
      }))
      expect(
        (await collectOperationalConditions(fixture(), new Date('2099-01-01'), friday))[0].key,
      ).toBe('report-missing:20990106')
      find.mockImplementation(async ({ collection, where }) => ({
        docs:
          collection === 'trademark-import-runs' && where.and
            ? [{ id: 1, counts: { published: 2 } }]
            : collection === 'publications'
              ? [{ id: 8 }]
              : collection === 'publication-issues' && where.and?.length === 3
                ? [{ id: 4, file: 9 }]
                : [],
        hasNextPage: false,
      }))
      expect(await collectOperationalConditions(fixture(), new Date('2099-01-01'), friday)).toEqual(
        [],
      )
    })
    it('stays disabled by default and rejects bad configuration', async () => {
      vi.stubEnv('OPERATIONS_MONITOR_ENABLED', 'false')
      expect(await runOperationalMonitor(fixture(), now)).toEqual({ skipped: true })
      expect(find).not.toHaveBeenCalled()
      vi.stubEnv('OPERATIONS_MONITOR_ENABLED', 'true')
      vi.stubEnv('OPERATIONS_MONITOR_SINCE', '')
      await expect(runOperationalMonitor(fixture(), now)).rejects.toThrow('activation')
    })
  },
)
