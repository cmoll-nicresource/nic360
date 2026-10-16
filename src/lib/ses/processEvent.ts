import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { inPayloadTransaction, transactionDb } from '@/lib/payloadTransaction'
import { flagUserByEmail } from '@/lib/emailFlags'
import { incrementPublicationIssueStat, type PublicationIssueStatColumn } from '@/lib/incrementStat'
import type { SesEvent } from './types'

export async function processSesEvent(payload: Payload, event: SesEvent, eventKey: string) {
  return inPayloadTransaction(payload, async (req) => {
    await transactionDb(payload, await req.transactionID).execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${eventKey}))`,
    )
    const existing = await payload.find({
      collection: 'ses-events',
      where: { eventKey: { equals: eventKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (existing.docs.length) return { duplicate: true }
    if (!event.test) {
      if (event.deliveryId && event.messageId) {
        const delivery = await payload
          .findByID({
            collection: 'newsletter-deliveries',
            id: event.deliveryId,
            depth: 0,
            overrideAccess: true,
            req,
          })
          .catch(() => null)
        const issueId = typeof delivery?.issue === 'object' ? delivery.issue?.id : delivery?.issue
        if (
          delivery &&
          issueId === event.issueId &&
          event.emails.map((e) => e.toLowerCase()).includes(delivery.recipientEmail) &&
          (!delivery.providerMessageId || delivery.providerMessageId === event.messageId)
        ) {
          await payload.update({
            collection: 'newsletter-deliveries',
            id: delivery.id,
            data: { status: 'sent', providerMessageId: event.messageId, lastError: null },
            overrideAccess: true,
            req,
          })
        }
      }
      if (event.type === 'Bounce' || event.type === 'Complaint')
        for (const email of event.emails)
          await flagUserByEmail(
            payload,
            email,
            event.type === 'Bounce' ? 'cleaned' : 'spam complaint',
            event.occurredAt,
            req,
          )
      const columns: Partial<Record<SesEvent['type'], PublicationIssueStatColumn>> = {
        Delivery: 'stats_delivered',
        Open: 'stats_opens',
        Click: 'stats_clicks',
        Bounce: 'stats_bounces',
        Complaint: 'stats_complaints',
      }
      const column = columns[event.type]
      if (event.issueId && column)
        await incrementPublicationIssueStat(
          payload,
          event.issueId,
          column,
          event.emails.length,
          req,
        )
    }
    await payload.create({
      collection: 'ses-events',
      data: { eventKey, kind: event.type, messageId: event.messageId, isTest: !!event.test },
      overrideAccess: true,
      req,
    })
    return { duplicate: false }
  })
}
