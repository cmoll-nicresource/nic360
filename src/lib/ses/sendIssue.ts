import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { inPayloadTransaction, transactionDb } from '@/lib/payloadTransaction'
import { getPublicationRecipients } from '@/lib/publicationRecipients'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { getSuppressedEmails } from '@/lib/suppressionList'
import { isEmailSafeModeEnabled } from '@/lib/emailSafeMode'
import { newsletterLiveConfig, createLiveSesClient } from './live'

export class NewsletterError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message)
  }
}

export async function queueNewsletter(
  payload: Payload,
  issueId: number,
  html: string,
  staffId?: number,
  adIds: number[] = [],
  recover = false,
) {
  newsletterLiveConfig()
  if (isEmailSafeModeEnabled())
    throw new NewsletterError('Audience sends are disabled in beta safe mode. Use Send test.')
  return inPayloadTransaction(payload, async (req) => {
    const tx = transactionDb(payload, await req.transactionID)
    const worker = await tx.execute(
      sql`SELECT pg_try_advisory_xact_lock(36031,${issueId}) AS available`,
    )
    if (!worker.rows[0].available)
      throw new NewsletterError(
        'A worker is currently delivering this issue. Wait for it to finish.',
      )
    const claim =
      await tx.execute(sql`UPDATE publication_issues SET email_status='sending', updated_at=now()
      WHERE id=${issueId} AND _status='published' AND (coalesce(email_status::text,'not sent') IN ('not sent','failed')
      OR (${recover} AND email_status='sending' AND updated_at < now()-interval '10 minutes')) RETURNING id`)
    if (!(claim as { rows: unknown[] }).rows.length)
      throw new NewsletterError(
        'This issue must be published and cannot already be sending or sent.',
      )
    const issue = await payload.findByID({
      collection: 'publication-issues',
      id: issueId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (!issue.email?.sendHtml) {
      const publicationId =
        typeof issue.publication === 'object' ? issue.publication.id : issue.publication
      const recipients = await getPublicationRecipients(payload, publicationId)
      if (!recipients.length)
        throw new NewsletterError(
          'No active, verified, opted-in readers are eligible for this issue.',
        )
      for (const recipient of recipients)
        await payload.create({
          collection: 'newsletter-deliveries',
          data: {
            deliveryKey: `${issueId}:${recipient.email}`,
            issue: issueId,
            user: recipient.userId,
            recipientEmail: recipient.email,
            status: 'queued',
          },
          overrideAccess: true,
          req,
        })
      await payload.update({
        collection: 'publication-issues',
        id: issueId,
        data: {
          email: {
            ...issue.email,
            provider: 'ses',
            status: 'sending',
            campaignId: `ses-${issueId}`,
            sendHtml: html,
            sendSubject: issue.title,
            sendAdIds: adIds,
            targetCount: recipients.length,
            lastError: null,
            sentBy: staffId,
          },
        },
        overrideAccess: true,
        req,
      })
    } else {
      await payload.update({
        collection: 'publication-issues',
        id: issueId,
        data: { email: { ...issue.email, status: 'sending', lastError: null } },
        overrideAccess: true,
        req,
      })
    }
    const job = await payload.jobs.queue({
      task: 'send-newsletter',
      input: { issueId },
      queue: 'newsletters',
      req,
    })
    return { queued: true, jobId: job.id }
  })
}

/** A server rejection is safe to retry; timeouts and disconnects are deliberately ambiguous. */
export function definiteSesRejection(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode
  return typeof status === 'number' && status >= 400 && status < 500
}

export async function runNewsletterSend(payload: Payload, issueId: number) {
  const lock = await payload.db.pool.connect()
  let acquired = false
  try {
    acquired = (await lock.query('SELECT pg_try_advisory_lock(36031,$1) AS acquired', [issueId]))
      .rows[0].acquired
    if (!acquired) return
    const issue = await payload.findByID({
      collection: 'publication-issues',
      id: issueId,
      depth: 0,
      overrideAccess: true,
    })
    if (issue.email?.status === 'sent') return
    newsletterLiveConfig()
    if (isEmailSafeModeEnabled())
      throw new Error('Audience delivery stopped because email safe mode is on.')
    if (!issue.email?.sendHtml || !issue.email.sendSubject)
      throw new Error('Newsletter snapshot is missing.')
    // A previous worker may have died after SES accepted a message but before recording its ID.
    await lock.query(
      "UPDATE newsletter_deliveries SET status='unknown',last_error='Worker interrupted during SES request; review before any manual resend.',updated_at=now() WHERE issue_id=$1 AND status='sending'",
      [issueId],
    )
    const publicationId =
      typeof issue.publication === 'object' ? issue.publication.id : issue.publication
    const client = createLiveSesClient()
    // Stable ID cursor: changing delivery statuses must not shift offset pages.
    let after = 0
    for (;;) {
      const result = await payload.find({
        collection: 'newsletter-deliveries',
        where: {
          and: [
            { issue: { equals: issueId } },
            { id: { greater_than: after } },
            { status: { in: ['queued', 'failed'] } },
          ],
        },
        sort: 'id',
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      if (!result.docs.length) break
      for (const delivery of result.docs) {
        after = delivery.id
        const userId = typeof delivery.user === 'object' ? delivery.user?.id : delivery.user
        const user = userId
          ? await payload
              .findByID({ collection: 'users', id: userId, depth: 1, overrideAccess: true })
              .catch(() => null)
          : null
        const optedIn = user?.emailPublications?.some(
          (p) => (typeof p === 'object' ? p.id : p) === publicationId,
        )
        if (
          !user ||
          user.email.toLowerCase() !== delivery.recipientEmail ||
          user.status !== 'active' ||
          !user._verified ||
          !optedIn ||
          !planSatisfies(await getReaderPlan(user, payload), 'base') ||
          (await getSuppressedEmails(payload)).has(delivery.recipientEmail)
        ) {
          await payload.update({
            collection: 'newsletter-deliveries',
            id: delivery.id,
            data: { status: 'skipped', lastError: 'Reader is no longer eligible or opted in.' },
            overrideAccess: true,
          })
          continue
        }
        // Recheck the environment between messages as well as at the start of the job.
        if (isEmailSafeModeEnabled())
          throw new Error('Audience delivery stopped because email safe mode is on.')
        await payload.update({
          collection: 'newsletter-deliveries',
          id: delivery.id,
          data: { status: 'sending', lastError: null },
          overrideAccess: true,
        })
        try {
          await client.sendBulk({
            issueId,
            subject: issue.email.sendSubject,
            html: issue.email.sendHtml,
            recipients: [{ email: delivery.recipientEmail, userId: user.id }],
            deliveryId: delivery.id,
            onAccepted: async (providerMessageId) => {
              await payload.update({
                collection: 'newsletter-deliveries',
                id: delivery.id,
                data: { status: 'sent', providerMessageId },
                overrideAccess: true,
              })
            },
          })
        } catch (error) {
          await lock.query(
            "UPDATE newsletter_deliveries SET status=$1,last_error=$2,updated_at=now() WHERE id=$3 AND status='sending'",
            [
              definiteSesRejection(error) ? 'failed' : 'unknown',
              error instanceof Error ? error.message.slice(0, 1000) : 'SES request failed',
              delivery.id,
            ],
          )
        }
        // Conservative default below the SES sandbox's one-message/second rate.
        await new Promise((resolve) => setTimeout(resolve, 1100))
      }
    }
    const totals = (
      await lock.query(
        "SELECT count(*) FILTER(WHERE status='sent')::int accepted,count(*) FILTER(WHERE status IN ('unknown','failed','sending','queued'))::int incomplete FROM newsletter_deliveries WHERE issue_id=$1",
        [issueId],
      )
    ).rows[0]
    await inPayloadTransaction(payload, async (req) => {
      const tx = transactionDb(payload, await req.transactionID)
      if (totals.accepted > 0 && !issue.email?.adsRecorded && Array.isArray(issue.email?.sendAdIds))
        for (const id of issue.email.sendAdIds) {
          if (typeof id === 'number' && Number.isSafeInteger(id))
            await tx.execute(
              sql`UPDATE publication_ads SET stats_impressions=coalesce(stats_impressions,0)+1 WHERE id=${id}`,
            )
        }
      await payload.update({
        collection: 'publication-issues',
        id: issueId,
        data: {
          email: {
            ...issue.email,
            status: totals.incomplete ? 'failed' : 'sent',
            adsRecorded: !!issue.email?.adsRecorded || totals.accepted > 0,
            sentAt: totals.incomplete ? null : new Date().toISOString(),
            lastError: totals.incomplete
              ? 'Some deliveries failed or have an unknown outcome. See Newsletter deliveries. Retry sends only known failures and queued recipients; accepted and unknown deliveries are skipped.'
              : null,
          },
        },
        overrideAccess: true,
        req,
      })
      await tx.execute(
        sql`WITH counts AS (UPDATE publication_issues SET stats_recipient_count=${totals.accepted} WHERE id=${issueId} RETURNING id,stats_recipient_count)
          UPDATE _publication_issues_v v SET version_stats_recipient_count=counts.stats_recipient_count FROM counts WHERE v.parent_id=counts.id AND v.latest=true`,
      )
    })
  } catch (error) {
    if (acquired)
      await payload.update({
        collection: 'publication-issues',
        id: issueId,
        context: { newsletterSystem: true },
        data: {
          email: {
            status: 'failed',
            lastError: error instanceof Error ? error.message : 'Newsletter worker failed',
          },
        },
        overrideAccess: true,
      })
    throw error
  } finally {
    try {
      if (acquired) await lock.query('SELECT pg_advisory_unlock(36031,$1)', [issueId])
    } finally {
      lock.release()
    }
  }
}
