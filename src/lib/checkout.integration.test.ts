import 'dotenv/config'
import crypto from 'node:crypto'
import type { CollectionSlug, Payload } from 'payload'
import type { Event, User } from '@/payload-types'
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import { checkoutInput, createEventCheckout } from './createEventCheckout'
import { markOrderPaid, sendOrderInvitations } from './orderFulfillment'
import { handleStripeSession } from './stripeFulfillment'
import { hasActiveRegistration } from '@/access/eventAccess'

const { createSession, retrieveSession } = vi.hoisted(() => ({
  createSession: vi.fn(),
  retrieveSession: vi.fn(),
}))
vi.mock('./stripe', () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: createSession, retrieve: retrieveSession } },
  }),
}))

describe.skipIf(process.env.CHECKOUT_INTEGRATION !== '1')(
  'transactional event checkout on disposable PostgreSQL',
  () => {
    let payload: Payload, buyer: User
    const records: { collection: CollectionSlug; id: number | string }[] = []
    const marker = 'checkout-' + crypto.randomUUID()
    let seq = 0
    const email = () => `${marker}-${++seq}@example.invalid`
    async function event(price = 1.01, capacity = 50) {
      const doc = await payload.create({
        collection: 'events',
        data: {
          name: marker,
          channel: 'infocus',
          startsAt: '2099-01-01T12:00:00Z',
          endDate: '2099-01-02T00:00:00Z',
          ticketTypes: [
            { name: 'General', onSale: true, capacity, inPerson: { price }, virtual: { price: 0 } },
          ],
        },
        overrideAccess: true,
      })
      records.push({ collection: 'events', id: doc.id })
      return doc
    }
    async function code(event: Event, percentOff: number, maxUses = 100, extra = {}) {
      const doc = await payload.create({
        collection: 'discount-codes',
        data: { code: `${marker}-${++seq}`, event: event.id, percentOff, maxUses, ...extra },
        overrideAccess: true,
      })
      records.push({ collection: 'discount-codes', id: doc.id })
      return doc
    }
    const input = (emails = [email()], discountCode?: string, attendance = 'in-person') => ({
      ticketTypeName: 'General',
      attendance,
      discountCode,
      attendees: emails.map((email) => ({ name: 'Fixture Colleague', email })),
    })
    beforeAll(async () => {
      const url = new URL(process.env.DATABASE_URI || '')
      if (
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        !url.pathname.includes('_test') ||
        process.env.S3_BUCKET
      )
        throw new Error('Use a disposable loopback _test database and local files.')
      vi.stubEnv('SES_ACCESS_KEY_ID', '')
      vi.stubEnv('SES_SECRET_ACCESS_KEY', '')
      const { getPayload } = await import('payload'),
        { default: config } = await import('@/payload.config')
      const resolved = await config
      resolved.jobs!.autoRun = []
      payload = await getPayload({ config: resolved })
      buyer = await payload.create({
        collection: 'users',
        data: { email: email(), password: crypto.randomUUID(), status: 'active', _verified: true },
        disableVerificationEmail: true,
      })
    }, 60000)
    beforeEach(() => {
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'test-fixture-not-a-live-secret')
      vi.stubEnv('STRIPE_MODE', 'test')
      createSession.mockReset().mockImplementation(async () => ({
        id: `cs_test_${++seq}`,
        url: 'https://checkout.example.invalid/test',
      }))
      retrieveSession.mockReset()
      vi.restoreAllMocks()
    })
    afterAll(async () => {
      // This database is disposable and removed by the caller, including queued fixtures.
      await payload?.destroy()
      vi.unstubAllEnvs()
    })
    it('validates attendee input before persistence', async () => {
      expect(() => checkoutInput({})).toThrow()
      const address = email()
      expect(() => checkoutInput(input([address, address.toUpperCase()]))).toThrow('once')
      expect(() => checkoutInput(input(['not-an-email']))).toThrow('valid email')
    })
    it('keeps unpaid tickets pending without access or colleague accounts', async () => {
      const ev = await event(),
        address = email()
      const result = await createEventCheckout(payload, buyer, ev.id, input([buyer.email, address]))
      const regs = await payload.find({
        collection: 'event-registrations',
        where: { order: { equals: result.orderId } },
        depth: 0,
      })
      expect(regs.docs.every((r) => r.status === 'pending')).toBe(true)
      expect(regs.docs.every((r) => r.amountPaid === 0)).toBe(true)
      expect(await hasActiveRegistration(payload, { ...buyer, collection: 'users' }, ev.id)).toBe(
        false,
      )
      expect(
        (await payload.count({ collection: 'users', where: { email: { equals: address } } }))
          .totalDocs,
      ).toBe(0)
    })
    it('matches charged cents to discounted total and registration allocations', async () => {
      const ev = await event(),
        discount = await code(ev, 25)
      const result = await createEventCheckout(
        payload,
        buyer,
        ev.id,
        input([email(), email(), email()], discount.code),
      )
      const order = await payload.findByID({ collection: 'orders', id: result.orderId })
      expect(order.total).toBe(2.27)
      const lines = createSession.mock.calls[0][0].line_items
      expect(
        lines.reduce(
          (sum: number, l: { quantity: number; price_data: { unit_amount: number } }) =>
            sum + l.quantity * l.price_data.unit_amount,
          0,
        ),
      ).toBe(227)
      await markOrderPaid(payload, order.id, 'pi_rounding_fixture')
      const regs = await payload.find({
        collection: 'event-registrations',
        where: { order: { equals: order.id } },
      })
      expect(Math.round(regs.docs.reduce((sum, r) => sum + r.amountPaid, 0) * 100)).toBe(227)
    })
    it('serializes concurrent checkout capacity and discount reservations', async () => {
      const ev = await event(10, 1),
        discount = await code(ev, 25, 1)
      const results = await Promise.allSettled([
        createEventCheckout(payload, buyer, ev.id, input([email()], discount.code)),
        createEventCheckout(payload, buyer, ev.id, input([email()], discount.code)),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    })
    it('rejects wrong-event, expired and restricted discount codes', async () => {
      const ev = await event(),
        other = await event(),
        wrong = await code(other, 25),
        expired = await code(ev, 25, 10, { expiresAt: '2000-01-01T00:00:00Z' }),
        restricted = await code(ev, 25, 10, { ticketTypes: [{ name: 'VIP' }] })
      for (const discount of [wrong, expired, restricted])
        await expect(
          createEventCheckout(payload, buyer, ev.id, input([email()], discount.code)),
        ).rejects.toThrow()
    })
    it('fulfills duplicate concurrent payment notifications once and invites only new colleagues', async () => {
      const ev = await event(),
        address = email(),
        checkout = await createEventCheckout(payload, buyer, ev.id, input([buyer.email, address]))
      const order = await payload.findByID({ collection: 'orders', id: checkout.orderId })
      retrieveSession.mockResolvedValue({
        id: order.stripeSessionId,
        mode: 'payment',
        status: 'complete',
        payment_status: 'paid',
        livemode: false,
        currency: 'usd',
        amount_total: 202,
        metadata: { orderId: String(order.id), nic360: 'events' },
        payment_intent: 'pi_fixture',
      })
      await Promise.all([
        handleStripeSession(payload, order.stripeSessionId!),
        handleStripeSession(payload, order.stripeSessionId!),
      ])
      expect((await payload.findByID({ collection: 'orders', id: order.id })).status).toBe('paid')
      expect(
        (await payload.count({ collection: 'users', where: { email: { equals: address } } }))
          .totalDocs,
      ).toBe(1)
      expect(
        (
          await payload.find({
            collection: 'payload-jobs',
            where: {
              and: [
                { taskSlug: { equals: 'invite-event-attendees' } },
                { 'input.orderId': { equals: order.id } },
              ],
            },
          })
        ).totalDocs,
      ).toBe(1)
      const invite = vi.spyOn(payload, 'forgotPassword').mockResolvedValue('fixture-token')
      await sendOrderInvitations(payload, order.id)
      await sendOrderInvitations(payload, order.id)
      expect(invite).toHaveBeenCalledTimes(1)
      expect(invite.mock.calls[0][0].data.email).toBe(address)
      expect(await hasActiveRegistration(payload, { ...buyer, collection: 'users' }, ev.id)).toBe(
        true,
      )
    })
    it('retries partial invitation failure without repeating successful invites', async () => {
      const ev = await event(),
        checkout = await createEventCheckout(payload, buyer, ev.id, input([email(), email()]))
      await markOrderPaid(payload, checkout.orderId, 'pi_fixture')
      const invite = vi
        .spyOn(payload, 'forgotPassword')
        .mockResolvedValueOnce('sent')
        .mockRejectedValueOnce(new Error('mail failed'))
        .mockResolvedValue('retry')
      await expect(sendOrderInvitations(payload, checkout.orderId)).rejects.toThrow('mail failed')
      await sendOrderInvitations(payload, checkout.orderId)
      expect(invite).toHaveBeenCalledTimes(3)
      expect(invite.mock.calls[0][0].data.email).not.toBe(invite.mock.calls[2][0].data.email)
    })
    it('fulfills free and 100%-off orders with the same durable invitation path', async () => {
      const ev = await event(),
        discount = await code(ev, 100)
      for (const data of [
        input([email()], discount.code),
        input([email()], undefined, 'virtual'),
      ]) {
        const result = await createEventCheckout(payload, buyer, ev.id, data)
        expect(result.comped).toBe(true)
        expect((await payload.findByID({ collection: 'orders', id: result.orderId })).status).toBe(
          'paid',
        )
        const regs = await payload.find({
          collection: 'event-registrations',
          where: { order: { equals: result.orderId } },
        })
        expect(regs.docs[0].inviteRequired).toBe(true)
        expect(regs.docs[0].status).toBe('active')
      }
      expect(createSession).not.toHaveBeenCalled()
    })
    it('does not grant tickets for an unpaid or mismatched Stripe session', async () => {
      const ev = await event(),
        result = await createEventCheckout(payload, buyer, ev.id, input())
      const order = await payload.findByID({ collection: 'orders', id: result.orderId })
      const session = {
        id: order.stripeSessionId,
        mode: 'payment',
        status: 'complete',
        payment_status: 'unpaid',
        livemode: false,
        currency: 'usd',
        amount_total: 101,
        metadata: { orderId: String(order.id), nic360: 'events' },
      }
      retrieveSession.mockResolvedValue(session)
      await handleStripeSession(payload, order.stripeSessionId!)
      expect((await payload.findByID({ collection: 'orders', id: order.id })).status).toBe(
        'pending',
      )
      for (const changed of [
        { amount_total: 1 },
        { currency: 'eur' },
        { id: 'cs_wrong' },
        { livemode: true },
      ]) {
        retrieveSession.mockResolvedValue({ ...session, payment_status: 'paid', ...changed })
        await expect(handleStripeSession(payload, order.stripeSessionId!)).rejects.toThrow()
      }
    })
    it('expires pending sessions idempotently and releases reservations', async () => {
      const ev = await event(10, 1),
        result = await createEventCheckout(payload, buyer, ev.id, input())
      const order = await payload.findByID({ collection: 'orders', id: result.orderId })
      retrieveSession.mockResolvedValue({
        id: order.stripeSessionId,
        mode: 'payment',
        status: 'expired',
        payment_status: 'unpaid',
        livemode: false,
        currency: 'usd',
        amount_total: 1000,
        metadata: { orderId: String(order.id), nic360: 'events' },
      })
      await handleStripeSession(payload, order.stripeSessionId!)
      await handleStripeSession(payload, order.stripeSessionId!)
      expect((await payload.findByID({ collection: 'orders', id: order.id })).status).toBe(
        'cancelled',
      )
      await expect(createEventCheckout(payload, buyer, ev.id, input())).resolves.toBeTruthy()
    })
    it('rechecks capacity before activating a late payment whose hold expired', async () => {
      const ev = await event(10, 1)
      const first = await createEventCheckout(payload, buyer, ev.id, input())
      await payload.update({
        collection: 'orders',
        id: first.orderId,
        data: { checkoutExpiresAt: '2000-01-01T00:00:00Z' },
      })
      const second = await createEventCheckout(payload, buyer, ev.id, input())
      await expect(markOrderPaid(payload, first.orderId, 'pi_late')).rejects.toThrow('capacity')
      await markOrderPaid(payload, second.orderId, 'pi_on_time')
      const count = await payload.count({
        collection: 'event-registrations',
        where: { and: [{ event: { equals: ev.id } }, { status: { equals: 'active' } }] },
      })
      expect(count.totalDocs).toBe(1)
    })
    it('honors subscriber pricing and independently enforces discount-use limits', async () => {
      const provider = await payload.create({
        collection: 'access-providers',
        data: { name: marker, plan: 'base', status: 'live' },
      })
      const ev = await event(10)
      await payload.update({
        collection: 'events',
        id: ev.id,
        data: {
          ticketTypes: [
            { name: 'General', onSale: true, inPerson: { price: 10, subscriberPrice: 6 } },
          ],
        },
      })
      const discount = await code(ev, 25, 1)
      const result = await createEventCheckout(
        payload,
        { ...buyer, accessProvider: provider.id },
        ev.id,
        input([email()], discount.code),
      )
      expect((await payload.findByID({ collection: 'orders', id: result.orderId })).total).toBe(4.5)
      await expect(
        createEventCheckout(payload, buyer, ev.id, input([email()], discount.code)),
      ).rejects.toThrow('0 use(s)')
    })
    it('fails closed without webhook setup before creating an order', async () => {
      const ev = await event()
      vi.stubEnv('STRIPE_WEBHOOK_SECRET', '')
      await expect(createEventCheckout(payload, buyer, ev.id, input())).rejects.toThrow(
        'incomplete',
      )
      expect(
        (await payload.count({ collection: 'orders', where: { event: { equals: ev.id } } }))
          .totalDocs,
      ).toBe(0)
    })
  },
)
