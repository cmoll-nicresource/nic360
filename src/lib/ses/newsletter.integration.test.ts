import dotenv from 'dotenv'
import crypto from 'node:crypto'
import type { CollectionSlug, Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { queueNewsletter, runNewsletterSend } from './sendIssue'
import { processSesEvent } from './processEvent'
import { getSuppressedEmails } from '@/lib/suppressionList'
import { unsubscribeToken } from './unsubscribe'
import { inPayloadTransaction } from '@/lib/payloadTransaction'
import { flagUserByEmail } from '@/lib/emailFlags'

const { sendBulk } = vi.hoisted(() => ({ sendBulk: vi.fn() }))
vi.mock('./live', () => ({
  newsletterLiveConfig: vi.fn(),
  createLiveSesClient: () => ({ sendBulk }),
}))

describe.skipIf(process.env.NEWSLETTER_INTEGRATION !== '1')(
  'newsletter delivery on real Payload/Postgres',
  () => {
    let payload: Payload, publicationId: number, providerId: number
    const records: { collection: CollectionSlug; id: number | string }[] = []
    const marker = `newsletter-fixture-${crypto.randomUUID()}`
    let sequence = 0
    beforeAll(async () => {
      dotenv.config()
      if (
        !process.env.DATABASE_URI ||
        !['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URI).hostname) ||
        process.env.S3_BUCKET
      )
        throw new Error('Isolated loopback database and local file storage required')
      vi.stubEnv('SES_ACCESS_KEY_ID', '')
      vi.stubEnv('SES_SECRET_ACCESS_KEY', '')
      vi.stubEnv('EMAIL_PROVIDER', 'ses')
      vi.stubEnv('EMAIL_SAFE_MODE', 'off')
      const { getPayload } = await import('payload')
      const { default: config } = await import('@/payload.config')
      const resolved = await config
      resolved.jobs!.autoRun = []
      payload = await getPayload({ config: resolved })
      const provider = await payload.create({
        collection: 'access-providers',
        data: { name: marker, plan: 'base', status: 'live' },
        overrideAccess: true,
      })
      providerId = provider.id
      records.push({ collection: 'access-providers', id: provider.id })
      const publication = await payload.create({
        collection: 'publications',
        data: {
          title: marker,
          slug: marker,
          format: 'excerpt-list',
          category: ['news'],
          frequency: 'weekly',
          generator: 'manual',
        },
        overrideAccess: true,
      })
      publicationId = publication.id
      records.push({ collection: 'publications', id: publication.id })
    }, 60000)
    beforeEach(() => {
      sendBulk.mockReset()
      sendBulk.mockImplementation(async (input) => {
        await input.onAccepted?.('fixture-' + crypto.randomUUID())
        return { messageCount: 1 }
      })
    })
    afterAll(async () => {
      if (payload) {
        for (const record of records.reverse())
          await payload.delete({ ...record, overrideAccess: true })
        await payload.destroy()
      }
      vi.unstubAllEnvs()
    }, 60000)
    async function reader() {
      const user = await payload.create({
        collection: 'users',
        data: {
          email: `${marker}-${++sequence}@example.invalid`,
          password: crypto.randomBytes(24).toString('hex'),
          _verified: true,
          status: 'active',
          accessProvider: providerId,
          emailPublications: [publicationId],
        },
        disableVerificationEmail: true,
        overrideAccess: true,
      })
      records.push({ collection: 'users', id: user.id })
      return user
    }
    async function issue() {
      const issue = await payload.create({
        collection: 'publication-issues',
        data: {
          title: marker,
          publication: publicationId,
          email: { subject: 'Ignored legacy subject override' },
          format: 'excerpt-list',
          issueDate: new Date().toISOString(),
          _status: 'published',
        },
        overrideAccess: true,
      })
      records.push({ collection: 'publication-issues', id: issue.id })
      return issue
    }
    async function queue(issueId: number) {
      const job = await queueNewsletter(
        payload,
        issueId,
        '<body>Snapshot HTML</body>',
      )
      records.push({ collection: 'payload-jobs', id: job.jobId })
      const deliveries = await payload.find({
        collection: 'newsletter-deliveries',
        where: { issue: { equals: issueId } },
        limit: 100,
        overrideAccess: true,
      })
      for (const doc of deliveries.docs)
        records.push({ collection: 'newsletter-deliveries', id: doc.id })
      return deliveries.docs
    }
    it('serializes simultaneous sends, snapshots content, and does not resend accepted recipients', async () => {
      await reader()
      const edition = await issue()
      const results = await Promise.allSettled([queue(edition.id), queue(edition.id)])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      await runNewsletterSend(payload, edition.id)
      expect(sendBulk).toHaveBeenCalledTimes(1)
      expect(sendBulk.mock.calls[0][0]).toMatchObject({
        subject: edition.title,
        html: '<body>Snapshot HTML</body>',
      })
      await runNewsletterSend(payload, edition.id)
      expect(sendBulk).toHaveBeenCalledTimes(1)
      expect(
        (
          await payload.findByID({
            collection: 'publication-issues',
            id: edition.id,
            overrideAccess: true,
          })
        ).email?.status,
      ).toBe('sent')
    }, 30000)
    it('processes a bounce once, preserves prior preferences, and skips the now-suppressed queued reader', async () => {
      const user = await reader()
      const edition = await issue()
      await queue(edition.id)
      const key = marker + '-bounce'
      const event = {
        type: 'Bounce' as const,
        emails: [user.email],
        issueId: edition.id,
        occurredAt: new Date().toISOString(),
        messageId: 'fixture-bounce',
      }
      await Promise.all([
        processSesEvent(payload, event, key),
        processSesEvent(payload, event, key),
      ])
      const flags = await payload.find({
        collection: 'email-flags',
        where: { user: { equals: user.id } },
        overrideAccess: true,
      })
      expect(flags.docs).toHaveLength(1)
      records.push({ collection: 'email-flags', id: flags.docs[0].id })
      expect(flags.docs[0].publicationsBefore).toHaveLength(1)
      expect(
        (
          await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 0,
            overrideAccess: true,
          })
        ).emailPublications,
      ).toEqual([])
      expect((await getSuppressedEmails(payload)).has(user.email)).toBe(true)
      const events = await payload.find({
        collection: 'ses-events',
        where: { eventKey: { equals: key } },
        overrideAccess: true,
      })
      records.push({ collection: 'ses-events', id: events.docs[0].id })
      expect(events.docs).toHaveLength(1)
      expect(
        (
          await payload.findByID({
            collection: 'publication-issues',
            id: edition.id,
            overrideAccess: true,
          })
        ).stats?.bounces,
      ).toBe(1)
      await runNewsletterSend(payload, edition.id)
      expect(sendBulk.mock.calls.some((c) => c[0].recipients[0].email === user.email)).toBe(false)
      expect(
        (
          await payload.findByID({
            collection: 'publication-issues',
            id: edition.id,
            overrideAccess: true,
          })
        ).stats?.bounces,
      ).toBe(1)
    }, 30000)
    it('records test events without changing audience preferences or campaign statistics', async () => {
      const user = await reader()
      const edition = await issue(),
        key = marker + '-test'
      await processSesEvent(
        payload,
        {
          type: 'Complaint',
          emails: [user.email],
          issueId: edition.id,
          occurredAt: new Date().toISOString(),
          test: true,
        },
        key,
      )
      const events = await payload.find({
        collection: 'ses-events',
        where: { eventKey: { equals: key } },
        overrideAccess: true,
      })
      records.push({ collection: 'ses-events', id: events.docs[0].id })
      expect(
        (
          await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 0,
            overrideAccess: true,
          })
        ).emailPublications,
      ).toEqual([publicationId])
      expect(
        (
          await payload.findByID({
            collection: 'publication-issues',
            id: edition.id,
            overrideAccess: true,
          })
        ).stats?.complaints,
      ).toBe(0)
    })
    it('unsubscribes with a signed one-click POST, leaves GET inert, and preserves choices on repeated POSTs', async () => {
      const user = await reader()
      const { GET, POST } = await import('@/app/api/newsletters/unsubscribe/route')
      const url = `http://localhost/api/newsletters/unsubscribe?token=${unsubscribeToken(user.id, user.email)}`
      expect((await GET(new Request(url))).status).toBe(200)
      expect(
        (
          await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 0,
            overrideAccess: true,
          })
        ).emailPublications,
      ).toEqual([publicationId])
      for (let n = 0; n < 2; n++)
        expect(
          (await POST(new Request(url, { method: 'POST', body: 'List-Unsubscribe=One-Click' })))
            .status,
        ).toBe(200)
      const flags = await payload.find({
        collection: 'email-flags',
        where: { user: { equals: user.id } },
        depth: 0,
        overrideAccess: true,
      })
      records.push({ collection: 'email-flags', id: flags.docs[0].id })
      expect(flags.docs).toHaveLength(1)
      expect(flags.docs[0].publicationsBefore).toEqual([publicationId])
      expect(
        (
          await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 0,
            overrideAccess: true,
          })
        ).emailPublications,
      ).toEqual([])
    })
    it('rolls back the suppression flag and preference changes together on failure', async () => {
      const user = await reader()
      await expect(
        inPayloadTransaction(payload, async (req) => {
          await flagUserByEmail(
            payload,
            user.email,
            'spam complaint',
            new Date().toISOString(),
            req,
          )
          throw new Error('Forced transaction failure')
        }),
      ).rejects.toThrow('Forced transaction failure')
      expect(
        (
          await payload.findByID({
            collection: 'users',
            id: user.id,
            depth: 0,
            overrideAccess: true,
          })
        ).emailPublications,
      ).toEqual([publicationId])
      expect(
        (
          await payload.count({
            collection: 'email-flags',
            where: { user: { equals: user.id } },
            overrideAccess: true,
          })
        ).totalDocs,
      ).toBe(0)
    })
    it('can retry a definitive server rejection without resending accepted messages', async () => {
      const user = await reader(),
        edition = await issue()
      await queue(edition.id)
      sendBulk.mockImplementation(async (input) => {
        if (input.recipients[0].email === user.email)
          throw Object.assign(new Error('Throttled'), { $metadata: { httpStatusCode: 400 } })
        await input.onAccepted('fixture-accepted')
        return { messageCount: 1 }
      })
      await runNewsletterSend(payload, edition.id)
      const calls = sendBulk.mock.calls.length
      sendBulk.mockImplementation(async (input) => {
        await input.onAccepted('fixture-retry')
        return { messageCount: 1 }
      })
      const retry = await queueNewsletter(payload, edition.id, 'Ignored')
      records.push({ collection: 'payload-jobs', id: retry.jobId })
      await runNewsletterSend(payload, edition.id)
      expect(sendBulk).toHaveBeenCalledTimes(calls + 1)
      expect(
        (
          await payload.findByID({
            collection: 'publication-issues',
            id: edition.id,
            overrideAccess: true,
          })
        ).email?.status,
      ).toBe('sent')
    }, 30000)
    it('recovers an interrupted worker after ten minutes while preserving uncertain attempts', async () => {
      const user = await reader(),
        edition = await issue()
      const deliveries = await queue(edition.id)
      await expect(
        queueNewsletter(payload, edition.id, 'Ignored', undefined, [], true),
      ).rejects.toThrow()
      const delivery = deliveries.find((d) => d.recipientEmail === user.email)!
      await payload.update({
        collection: 'newsletter-deliveries',
        id: delivery.id,
        data: { status: 'sending' },
        overrideAccess: true,
      })
      await payload.db.pool.query(
        "UPDATE publication_issues SET updated_at=now()-interval '11 minutes' WHERE id=$1",
        [edition.id],
      )
      const recovered = await queueNewsletter(
        payload,
        edition.id,
        'Ignored',
        undefined,
        [],
        true,
      )
      records.push({ collection: 'payload-jobs', id: recovered.jobId })
      await runNewsletterSend(payload, edition.id)
      expect(
        (
          await payload.findByID({
            collection: 'newsletter-deliveries',
            id: delivery.id,
            overrideAccess: true,
          })
        ).status,
      ).toBe('unknown')
      expect(sendBulk.mock.calls.some((c) => c[0].recipients[0].email === user.email)).toBe(false)
    }, 30000)
    it('reconciles an uncertain acceptance from a verified delivery event and counts its SNS retry once', async () => {
      const user = await reader(),
        edition = await issue()
      const deliveries = await queue(edition.id)
      const delivery = deliveries.find((d) => d.recipientEmail === user.email)!
      await payload.update({
        collection: 'newsletter-deliveries',
        id: delivery.id,
        data: { status: 'unknown' },
        overrideAccess: true,
      })
      const key = marker + '-reconcile'
      const event = {
        type: 'Delivery' as const,
        emails: [user.email],
        issueId: edition.id,
        deliveryId: delivery.id,
        messageId: 'verified-provider-id',
        occurredAt: new Date().toISOString(),
      }
      await processSesEvent(payload, event, key)
      await processSesEvent(payload, event, key)
      const events = await payload.find({
        collection: 'ses-events',
        where: { eventKey: { equals: key } },
        overrideAccess: true,
      })
      records.push({ collection: 'ses-events', id: events.docs[0].id })
      expect(
        await payload.findByID({
          collection: 'newsletter-deliveries',
          id: delivery.id,
          overrideAccess: true,
        }),
      ).toMatchObject({ status: 'sent', providerMessageId: 'verified-provider-id' })
      expect(
        (
          await payload.findByID({
            collection: 'publication-issues',
            id: edition.id,
            overrideAccess: true,
          })
        ).stats?.delivered,
      ).toBe(1)
    })
    it('preserves authoritative metrics across queueing, concurrent version saves, worker finalization and editorial saves', async () => {
      const user = await reader(),
        edition = await issue()
      const event = {
        type: 'Delivery' as const,
        emails: [user.email],
        issueId: edition.id,
        messageId: 'metric-fixture',
        occurredAt: new Date().toISOString(),
      }
      const keys = [
        marker + '-metrics-delivery',
        marker + '-metrics-open-1',
        marker + '-metrics-open-2',
      ]
      await processSesEvent(payload, event, keys[0])
      await queue(edition.id)
      expect(
        (
          await payload.findByID({
            collection: 'publication-issues',
            id: edition.id,
            overrideAccess: true,
          })
        ).stats?.delivered,
      ).toBe(1)
      await Promise.all([
        processSesEvent(payload, { ...event, type: 'Open' }, keys[1]),
        processSesEvent(payload, { ...event, type: 'Open' }, keys[2]),
        payload.update({
          collection: 'publication-issues',
          id: edition.id,
          context: { newsletterSystem: true },
          data: { email: { lastError: 'Concurrent metadata save' } },
          overrideAccess: true,
        }),
      ])
      for (const key of keys) {
        const events = await payload.find({
          collection: 'ses-events',
          where: { eventKey: { equals: key } },
          overrideAccess: true,
        })
        records.push({ collection: 'ses-events', id: events.docs[0].id })
      }
      await runNewsletterSend(payload, edition.id)
      const saved = await payload.update({
        collection: 'publication-issues',
        id: edition.id,
        data: { title: marker + ' edited', stats: { delivered: 999, opens: 999 } },
        overrideAccess: true,
      })
      expect(saved.stats).toMatchObject({ delivered: 1, opens: 2 })
      const draft = await payload.findByID({
        collection: 'publication-issues',
        id: edition.id,
        draft: true,
        overrideAccess: true,
      })
      const published = await payload.findByID({
        collection: 'publication-issues',
        id: edition.id,
        draft: false,
        overrideAccess: true,
      })
      expect(draft.stats).toEqual(published.stats)
      expect(draft.stats?.recipientCount).toBeGreaterThan(0)
    }, 30000)
    it('never retries an ambiguous timeout, but can retry a definitive SES rejection without resending successes', async () => {
      const user = await reader()
      const edition = await issue()
      await queue(edition.id)
      sendBulk.mockImplementation(async (input) => {
        if (input.recipients[0].email === user.email)
          throw new Error('Timeout after request transmission')
        await input.onAccepted('fixture-accepted')
        return { messageCount: 1 }
      })
      await runNewsletterSend(payload, edition.id)
      const firstCalls = sendBulk.mock.calls.length
      const job = await queueNewsletter(payload, edition.id, 'Ignored')
      records.push({ collection: 'payload-jobs', id: job.jobId })
      await runNewsletterSend(payload, edition.id)
      expect(sendBulk).toHaveBeenCalledTimes(firstCalls)
      const unknown = await payload.find({
        collection: 'newsletter-deliveries',
        where: {
          and: [{ issue: { equals: edition.id } }, { recipientEmail: { equals: user.email } }],
        },
        depth: 0,
        overrideAccess: true,
      })
      expect(unknown.docs[0].status).toBe('unknown')
      // A reviewed server rejection is retryable; accepted rows remain untouched.
      await payload.update({
        collection: 'newsletter-deliveries',
        id: unknown.docs[0].id,
        data: { status: 'failed' },
        overrideAccess: true,
      })
      sendBulk.mockImplementation(async (input) => {
        await input.onAccepted('fixture-retry')
        return { messageCount: 1 }
      })
      const retry = await queueNewsletter(payload, edition.id, 'Ignored')
      records.push({ collection: 'payload-jobs', id: retry.jobId })
      await runNewsletterSend(payload, edition.id)
      expect(sendBulk).toHaveBeenCalledTimes(firstCalls + 1)
    }, 30000)
  },
)
