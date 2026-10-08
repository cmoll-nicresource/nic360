import type { Payload } from 'payload'

/**
 * Marks an order paid and, for each registration whose attendee doesn't yet
 * have an account, creates one and invites them by email (Payload's
 * built-in forgot-password email doubles as the invite: they get a link to
 * set a password and log in).
 */
export async function markOrderPaid(payload: Payload, orderId: number, paymentRef: string) {
  const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true }).catch(() => null)
  if (!order || order.status === 'paid') return

  await payload.update({
    collection: 'orders',
    id: orderId,
    data: { status: 'paid', paidAt: new Date().toISOString(), paymentRef },
    overrideAccess: true,
  })

  const { docs: registrations } = await payload.find({
    collection: 'event-registrations',
    where: { order: { equals: orderId } },
    limit: 100,
    overrideAccess: true,
  })

  for (const reg of registrations) {
    if (reg.attendee) continue

    const [firstName, ...rest] = reg.attendeeName.trim().split(/\s+/)
    const lastName = rest.join(' ') || firstName

    const newUser = await payload.create({
      collection: 'users',
      data: {
        firstName,
        lastName,
        email: reg.attendeeEmail,
        password: crypto.randomUUID(),
        _verified: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      disableVerificationEmail: true,
    })

    await payload.update({
      collection: 'event-registrations',
      id: reg.id,
      data: { attendee: newUser.id },
      overrideAccess: true,
    })

    await payload.forgotPassword({
      collection: 'users',
      data: { email: reg.attendeeEmail },
      disableEmail: false,
    })
  }
}
