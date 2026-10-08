import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'

import { lexicalFromText } from '../../src/lib/lexical'
import { findTicketType, priceOrder, ticketUnitPrice } from '../../src/lib/eventCheckout'

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
}

async function placeholderMedia(payload: Payload, alt: string) {
  const tmpPath = path.join(os.tmpdir(), `nic360-${alt.replace(/\W+/g, '-')}.png`)
  fs.writeFileSync(tmpPath, Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'))
  const doc = await payload.create({ collection: 'media', data: { alt }, filePath: tmpPath, overrideAccess: true })
  fs.unlinkSync(tmpPath)
  return doc
}

export async function seedSpeakersAndSponsors(payload: Payload) {
  console.log('Seeding speakers and sponsors...')
  const headshot = await placeholderMedia(payload, 'Speaker headshot placeholder')

  const speakerDefs = [
    { name: 'Dr. Amara Nwosu', role: 'Chief Science Officer', company: 'Altria Group' },
    { name: 'Hiroshi Tanaka', role: 'VP Regulatory Affairs', company: 'Japan Tobacco International' },
    { name: 'Dr. Lena Fischer', role: 'Director, Harm Reduction Research', company: 'British American Tobacco' },
    { name: 'Carlos Mendez', role: 'Head of Public Policy', company: 'Philip Morris International' },
    { name: 'Priya Ramaswamy', role: 'Professor of Public Health', company: 'University of Nairobi' },
  ]
  const speakers: Record<string, number> = {}
  for (const s of speakerDefs) {
    const doc = await payload.create({
      collection: 'speakers',
      data: { ...s, headshot: headshot.id, bio: `${s.name} is ${s.role} at ${s.company}.` },
      overrideAccess: true,
    })
    speakers[s.name] = doc.id
  }

  const logo = await placeholderMedia(payload, 'Sponsor logo placeholder')
  const sponsorDefs = [
    { name: 'Altria Group', website: 'https://www.altria.com' },
    { name: 'Philip Morris International', website: 'https://www.pmi.com' },
    { name: 'KT&G', website: 'https://www.ktng.com' },
  ]
  const sponsors: Record<string, number> = {}
  for (const s of sponsorDefs) {
    const doc = await payload.create({
      collection: 'sponsors',
      data: { name: s.name, website: s.website, logo: logo.id, description: lexicalFromText(`${s.name} is a proud sponsor.`) },
      overrideAccess: true,
    })
    sponsors[s.name] = doc.id
  }

  return { speakers, sponsors }
}

export async function seedEvents(payload: Payload, speakers: Record<string, number>, sponsors: Record<string, number>) {
  console.log('Seeding events...')

  const gtnf = await payload.create({
    collection: 'events',
    data: {
      name: 'GTNF 2026',
      channel: 'gtnf',
      startsAt: daysFromNow(60),
      endDate: daysFromNow(62),
      timezone: 'Europe/London',
      hasReplay: false,
      tagline: 'The Global Tobacco & Nicotine Forum',
      description: lexicalFromText('Three days of industry research, regulation and innovation.'),
      venue: { address: 'etc. venues, London' },
      ticketTypes: [
        {
          name: 'General Admission',
          onSale: true,
          capacity: 200,
          inPerson: { price: 1200, subscriberPrice: 900 },
          virtual: { price: 400, subscriberPrice: 300 },
        },
        {
          name: 'Academia',
          honorSystem: true,
          onSale: true,
          inPerson: { price: 300 },
          virtual: { price: 100 },
        },
      ],
      sponsors: [sponsors['Altria Group'], sponsors['Philip Morris International']],
      _status: 'published',
    },
    overrideAccess: true,
  })

  const atnf = await payload.create({
    collection: 'events',
    data: {
      name: 'ATNF 2026',
      channel: 'atnf',
      startsAt: daysFromNow(120),
      endDate: daysFromNow(121),
      timezone: 'America/New_York',
      hasReplay: true,
      tagline: 'The American Tobacco & Nicotine Forum',
      description: lexicalFromText('A two-day American conference, with session replays for registered attendees.'),
      venue: { address: 'Marriott Marquis, Washington DC' },
      ticketTypes: [
        {
          name: 'General Admission',
          onSale: true,
          capacity: 150,
          inPerson: { price: 900, subscriberPrice: 700 },
          virtual: { price: 350, subscriberPrice: 250 },
        },
      ],
      sponsors: [sponsors['KT&G']],
      _status: 'published',
    },
    overrideAccess: true,
  })

  const infocus = await payload.create({
    collection: 'events',
    data: {
      name: 'InFocus: Harm Reduction Webinar',
      channel: 'infocus',
      startsAt: daysFromNow(14),
      endDate: daysFromNow(14),
      timezone: 'America/New_York',
      hasReplay: true,
      tagline: 'A one-hour webinar on harm reduction research',
      description: lexicalFromText('Online-only webinar, recording available afterward to registrants.'),
      ticketTypes: [
        {
          name: 'Webinar Access',
          onSale: true,
          virtual: { price: 0 },
        },
      ],
      _status: 'published',
    },
    overrideAccess: true,
  })

  console.log('Seeding sessions...')
  await payload.create({
    collection: 'sessions',
    data: {
      event: gtnf.id,
      title: 'Opening Keynote: The State of Harm Reduction',
      description: 'A look at where reduced-risk products stand globally.',
      day: gtnf.startsAt,
      type: 'Keynote',
      room: 'Main Hall',
      speakers: [speakers['Dr. Amara Nwosu']],
      _status: 'published',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'sessions',
    data: {
      event: gtnf.id,
      title: 'Panel: Regulatory Trends in Asia-Pacific',
      day: gtnf.startsAt,
      type: 'Panel',
      room: 'Room B',
      moderators: [speakers['Carlos Mendez']],
      speakers: [speakers['Hiroshi Tanaka'], speakers['Priya Ramaswamy']],
      _status: 'published',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'sessions',
    data: {
      event: atnf.id,
      title: 'Keynote: Science of Harm Reduction',
      day: atnf.startsAt,
      type: 'Keynote',
      room: 'Grand Ballroom',
      speakers: [speakers['Dr. Lena Fischer']],
      replayEmbed: '<p>[placeholder video embed for registered attendees]</p>',
      _status: 'published',
    },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'sessions',
    data: {
      event: infocus.id,
      title: 'Webinar: Harm Reduction Research Update',
      day: infocus.startsAt,
      type: 'Other',
      speakers: [speakers['Dr. Lena Fischer'], speakers['Priya Ramaswamy']],
      replayEmbed: '<p>[placeholder recording embed for registered attendees]</p>',
      _status: 'published',
    },
    overrideAccess: true,
  })

  return { gtnf, atnf, infocus }
}

export async function seedDiscountCodeAndDemoPurchase(
  payload: Payload,
  gtnfId: number,
  accessProviderIdByName: (name: string) => Promise<number | undefined>,
) {
  console.log('Seeding a discount code and a demo ticket purchase...')

  const altriaId = await accessProviderIdByName('Altria Group')
  const discount = await payload.create({
    collection: 'discount-codes',
    data: {
      code: 'NRC25',
      event: gtnfId,
      accessProvider: altriaId,
      percentOff: 25,
      maxUses: 10,
    },
    overrideAccess: true,
  })

  const gtnf = await payload.findByID({ collection: 'events', id: gtnfId, overrideAccess: true })
  const ticketType = findTicketType(gtnf, 'General Admission')
  if (!ticketType) throw new Error('Expected a "General Admission" ticket type on GTNF 2026.')

  const { docs: buyers } = await payload.find({
    collection: 'users',
    where: { email: { equals: 'megan.clarke@altria.com' } },
    limit: 1,
    overrideAccess: true,
  })
  const { docs: colleagues } = await payload.find({
    collection: 'users',
    where: { email: { equals: 'devon.price@altria.com' } },
    limit: 1,
    overrideAccess: true,
  })
  const buyer = buyers[0]
  const colleague = colleagues[0]
  if (!buyer || !colleague) {
    console.log('  Skipped demo purchase: expected seeded users not found.')
    return
  }

  const unitPrice = ticketUnitPrice(ticketType, 'in-person', true) // Altria Group is a Base subscriber
  if (unitPrice == null) throw new Error('Expected an in-person price for General Admission.')

  const pricing = priceOrder({ unitPrice, attendeeCount: 2, discount, priceBasis: 'subscriber' })
  const order = await payload.create({
    collection: 'orders',
    data: {
      buyer: buyer.id,
      event: gtnfId,
      discountCode: discount.id,
      subtotal: pricing.subtotal,
      discount: pricing.discountAmount,
      total: pricing.total,
      status: 'paid',
      paidAt: new Date().toISOString(),
      paymentRef: 'seed_demo_payment',
    },
    overrideAccess: true,
  })

  const perTicketAmount = Math.round((pricing.total / 2) * 100) / 100
  for (const attendee of [
    { user: buyer, name: `${buyer.firstName} ${buyer.lastName}`, email: buyer.email },
    { user: colleague, name: `${colleague.firstName} ${colleague.lastName}`, email: colleague.email },
  ]) {
    await payload.create({
      collection: 'event-registrations',
      data: {
        order: order.id,
        event: gtnfId,
        attendee: attendee.user.id,
        attendeeName: attendee.name,
        attendeeEmail: attendee.email,
        ticketType: ticketType.name,
        attendance: 'in-person',
        priceBasis: 'subscriber',
        amountPaid: perTicketAmount,
        discountCode: discount.id,
        status: 'active',
      },
      overrideAccess: true,
    })
  }

  console.log(
    `  Order ${order.id}: 2 tickets to GTNF 2026 for ${buyer.email} + ${colleague.email}, ` +
      `discount code NRC25 applied, total $${pricing.total}.`,
  )
}
