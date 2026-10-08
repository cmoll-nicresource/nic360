import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { getMailchimpClient } from '@/lib/mailchimp'

/**
 * Mailchimp's one exception to "our site is the source of truth": an
 * unsubscribe, spam complaint or cleaned (bounced) address is honored here,
 * clearing the user's preferences and opening an EmailFlag for staff
 * follow-up. Accepts a simplified JSON body (see parseUnsubscribeWebhook);
 * live mode would need to also handle Mailchimp's real
 * application/x-www-form-urlencoded shape.
 */
export async function POST(request: Request) {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const client = getMailchimpClient(payload)

  const body = await request.json().catch(() => null)
  const event = client.parseUnsubscribeWebhook(body)
  if (!event) return NextResponse.json({ ok: true, ignored: true })

  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: event.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const user = docs[0]
  if (!user) return NextResponse.json({ ok: true, userNotFound: true })

  const publicationsBefore = user.emailPublications ?? []

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { emailPublications: [] },
    overrideAccess: true,
  })

  const flag = await payload.create({
    collection: 'email-flags',
    data: {
      user: user.id,
      reason: event.reason,
      occurredAt: event.occurredAt,
      publicationsBefore,
      status: 'open',
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true, flagId: flag.id })
}

// Mailchimp (and most webhook providers) GET the URL once to verify it exists.
export async function GET() {
  return NextResponse.json({ ok: true })
}
