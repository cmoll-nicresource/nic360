import { getPayload } from 'payload'
import { NextResponse } from 'next/server'

import config from '@/payload.config'
import { getMailchimpClient } from '@/lib/mailchimp'
import { flagUserByEmail } from '@/lib/emailFlags'
import { allowLocalWebhookSimulation, secretMatches } from '@/lib/localSafety'

/**
 * Mailchimp's one exception to "our site is the source of truth": an
 * unsubscribe, spam complaint or cleaned (bounced) address is honored here,
 * clearing the user's preferences and opening an EmailFlag for staff
 * follow-up. Accepts a simplified JSON body (see parseUnsubscribeWebhook);
 * live mode would need to also handle Mailchimp's real
 * application/x-www-form-urlencoded shape.
 */
export async function POST(request: Request) {
  if (!allowLocalWebhookSimulation(request)) {
    if (process.env.EMAIL_PROVIDER !== 'mailchimp' || process.env.MAILCHIMP_MODE !== 'live')
      return NextResponse.json({ error: 'Mailchimp webhook is disabled.' }, { status: 410 })
    if (
      !secretMatches(
        new URL(request.url).searchParams.get('secret'),
        process.env.MAILCHIMP_WEBHOOK_SECRET,
      )
    )
      return NextResponse.json({ error: 'Invalid webhook secret.' }, { status: 403 })
  }
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const client = getMailchimpClient(payload)

  const body = await request.json().catch(() => null)
  const event = client.parseUnsubscribeWebhook(body)
  if (!event) return NextResponse.json({ ok: true, ignored: true })

  const flagId = await flagUserByEmail(payload, event.email, event.reason, event.occurredAt)
  if (!flagId) return NextResponse.json({ ok: true, userNotFound: true })

  return NextResponse.json({ ok: true, flagId })
}

// Mailchimp (and most webhook providers) GET the URL once to verify it exists.
export async function GET() {
  return NextResponse.json({ ok: true })
}
