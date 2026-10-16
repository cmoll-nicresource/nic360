import crypto from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { inPayloadTransaction, transactionDb } from './payloadTransaction'
import { allocateTicketCents, reservedTicketWhere } from './eventCheckout'

/** Payment and ticket activation commit together. Invitations are durable queued work. */
export async function markOrderPaid(payload: Payload, orderId: number, paymentRef: string) {
  return inPayloadTransaction(payload, async (req) => {
    const tx = transactionDb(payload, await req.transactionID)
    await tx.execute(sql`SELECT id FROM orders WHERE id=${orderId} FOR UPDATE`)
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (order.status === 'paid') return
    if (order.status !== 'pending') throw new Error('Only a pending order can be fulfilled.')
    if (paymentRef === 'comped' && order.total !== 0)
      throw new Error('A paid ticket cannot be comped by payment fulfillment.')
    const eventId = typeof order.event === 'object' ? order.event.id : order.event
    await tx.execute(sql`SELECT id FROM events WHERE id=${eventId} FOR UPDATE`)
    const registrations = await payload.find({
      collection: 'event-registrations',
      where: { order: { equals: order.id } },
      pagination: false,
      sort: 'attendeeEmail',
      depth: 0,
      overrideAccess: true,
      req,
    })
    const event = await payload.findByID({
      collection: 'events',
      id: eventId,
      depth: 0,
      req,
      overrideAccess: true,
    })
    const types = new Map<string, number>()
    for (const reg of registrations.docs)
      types.set(reg.ticketType, (types.get(reg.ticketType) || 0) + 1)
    for (const [name, count] of types) {
      const capacity = event.ticketTypes?.find((ticket) => ticket.name === name)?.capacity
      if (capacity == null) continue
      const used = await payload.count({
        collection: 'event-registrations',
        where: {
          and: [
            { event: { equals: eventId } },
            { ticketType: { equals: name } },
            { order: { not_equals: orderId } },
            reservedTicketWhere(),
          ],
        },
        overrideAccess: true,
        req,
      })
      if (used.totalDocs + count > capacity)
        throw new Error(
          'Payment activation needs staff review: ticket capacity is no longer available.',
        )
    }
    if (order.discountCode) {
      const discountId =
        typeof order.discountCode === 'object' ? order.discountCode.id : order.discountCode
      const discount = await payload.findByID({
        collection: 'discount-codes',
        id: discountId,
        depth: 0,
        req,
        overrideAccess: true,
      })
      const used = await payload.count({
        collection: 'event-registrations',
        where: {
          and: [
            { discountCode: { equals: discountId } },
            { order: { not_equals: orderId } },
            reservedTicketWhere(),
          ],
        },
        req,
        overrideAccess: true,
      })
      if (used.totalDocs + registrations.docs.length > discount.maxUses)
        throw new Error(
          'Payment activation needs staff review: discount allocation is no longer available.',
        )
    }
    let needsInvite = false
    const paidCents = allocateTicketCents(order.total, registrations.docs.length)
    for (const [index, reg] of registrations.docs.entries()) {
      let attendeeId = typeof reg.attendee === 'object' ? reg.attendee?.id : reg.attendee
      let inviteRequired = !!reg.inviteRequired
      if (!attendeeId) {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(36042,hashtext(${reg.attendeeEmail.toLowerCase()}))`,
        )
        const existing = await payload.find({
          collection: 'users',
          where: { email: { equals: reg.attendeeEmail.toLowerCase() } },
          limit: 1,
          depth: 0,
          req,
          overrideAccess: true,
        })
        attendeeId = existing.docs[0]?.id
        if (!attendeeId) {
          const [firstName, ...rest] = reg.attendeeName.trim().split(/\s+/)
          const user = await payload.create({
            collection: 'users',
            data: {
              firstName,
              lastName: rest.join(' ') || firstName,
              email: reg.attendeeEmail.toLowerCase(),
              password: crypto.randomUUID(),
              _verified: true,
              status: 'active',
            },
            disableVerificationEmail: true,
            req,
            overrideAccess: true,
          })
          attendeeId = user.id
          inviteRequired = true
        }
      }
      await payload.update({
        collection: 'event-registrations',
        id: reg.id,
        data: {
          attendee: attendeeId,
          status: 'active',
          inviteRequired,
          amountPaid: paidCents[index] / 100,
        },
        req,
        overrideAccess: true,
      })
      needsInvite ||= inviteRequired && !reg.inviteSentAt
    }
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        status: 'paid',
        paidAt: new Date().toISOString(),
        paymentRef,
        fulfillmentError: null,
      },
      req,
      overrideAccess: true,
    })
    if (needsInvite)
      await payload.jobs.queue({
        task: 'invite-event-attendees',
        queue: 'event-invitations',
        input: { orderId },
        req,
      })
  })
}

/** One worker per order. Sent invitations are skipped on retry. */
export async function sendOrderInvitations(payload: Payload, orderId: number) {
  const lock = await payload.db.pool.connect()
  try {
    const acquired = await lock.query('SELECT pg_try_advisory_lock(36043,$1) AS available', [
      orderId,
    ])
    if (!acquired.rows[0].available) throw new Error('Another invitation worker is active.')
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
    })
    if (order.status !== 'paid') return
    const registrations = await payload.find({
      collection: 'event-registrations',
      where: {
        and: [
          { order: { equals: orderId } },
          { status: { equals: 'active' } },
          { inviteRequired: { equals: true } },
          { inviteSentAt: { exists: false } },
        ],
      },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const reg of registrations.docs) {
      await payload.forgotPassword({
        collection: 'users',
        data: { email: reg.attendeeEmail },
        disableEmail: false,
        context: { eventInvitation: true },
      })
      await payload.update({
        collection: 'event-registrations',
        id: reg.id,
        data: { inviteSentAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }
    await payload.update({
      collection: 'orders',
      id: orderId,
      data: { fulfillmentError: null },
      overrideAccess: true,
    })
  } catch (error) {
    await payload
      .update({
        collection: 'orders',
        id: orderId,
        data: {
          fulfillmentError:
            'Attendee invitation failed. Review the event-invitations job; retries skip invitations already recorded as sent.',
        },
        overrideAccess: true,
      })
      .catch(() => undefined)
    throw error
  } finally {
    await lock.query('SELECT pg_advisory_unlock(36043,$1)', [orderId]).catch(() => undefined)
    lock.release()
  }
}
