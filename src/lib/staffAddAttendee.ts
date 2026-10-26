import type { Payload } from 'payload'

import type { Event } from '@/payload-types'
import { findTicketType } from '@/lib/eventCheckout'

type AddExisting = { userId: number; ticketTypeName: string; attendance: 'in-person' | 'virtual' }
type AddNew = { name: string; email: string; ticketTypeName: string; attendance: 'in-person' | 'virtual' }

export type StaffAddAttendeeResult = { error: string } | { registrationId: number; orderId: number }

/**
 * Staff-added attendee: a $0 "comp" order + an active registration, with no
 * Stripe involved. Used by both "add existing user" and "register a new
 * user" on the event manage dashboard.
 */
export async function compRegisterExistingUser(
  payload: Payload,
  event: Event,
  input: AddExisting,
): Promise<StaffAddAttendeeResult> {
  const ticketType = findTicketType(event, input.ticketTypeName)
  if (!ticketType) return { error: 'Unknown ticket type.' }

  const user = await payload.findByID({ collection: 'users', id: input.userId, overrideAccess: true }).catch(() => null)
  if (!user) return { error: 'User not found.' }

  return createCompOrderAndRegistration(payload, event, {
    userId: user.id,
    attendeeName: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
    attendeeEmail: user.email,
    ticketTypeName: input.ticketTypeName,
    attendance: input.attendance,
  })
}

export async function compRegisterNewUser(
  payload: Payload,
  event: Event,
  input: AddNew,
): Promise<StaffAddAttendeeResult> {
  const ticketType = findTicketType(event, input.ticketTypeName)
  if (!ticketType) return { error: 'Unknown ticket type.' }

  const email = input.email.trim().toLowerCase()
  const { docs: existing } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })

  let userId: number
  if (existing[0]) {
    userId = existing[0].id
  } else {
    const [firstName, ...rest] = input.name.trim().split(/\s+/)
    const newUser = await payload.create({
      collection: 'users',
      data: {
        firstName,
        lastName: rest.join(' ') || firstName,
        email,
        password: crypto.randomUUID(),
        _verified: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      disableVerificationEmail: true,
    })
    userId = newUser.id
    await payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: false, context: { eventInvitation: true } })
  }

  return createCompOrderAndRegistration(payload, event, {
    userId,
    attendeeName: input.name.trim(),
    attendeeEmail: email,
    ticketTypeName: input.ticketTypeName,
    attendance: input.attendance,
  })
}

async function createCompOrderAndRegistration(
  payload: Payload,
  event: Event,
  input: { userId: number; attendeeName: string; attendeeEmail: string; ticketTypeName: string; attendance: 'in-person' | 'virtual' },
): Promise<StaffAddAttendeeResult> {
  const order = await payload.create({
    collection: 'orders',
    data: {
      buyer: input.userId,
      event: event.id,
      subtotal: 0,
      discount: 0,
      total: 0,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentRef: 'staff-added',
    },
    overrideAccess: true,
  })

  const registration = await payload.create({
    collection: 'event-registrations',
    data: {
      order: order.id,
      event: event.id,
      attendee: input.userId,
      attendeeName: input.attendeeName,
      attendeeEmail: input.attendeeEmail,
      ticketType: input.ticketTypeName,
      attendance: input.attendance,
      priceBasis: 'standard',
      amountPaid: 0,
      status: 'active',
    },
    overrideAccess: true,
  })

  return { registrationId: registration.id, orderId: order.id }
}
