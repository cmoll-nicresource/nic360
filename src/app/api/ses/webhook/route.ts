import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import MessageValidator from 'sns-validator'

import config from '@/payload.config'
import { parseSesEvent } from '@/lib/ses'
import { flagUserByEmail } from '@/lib/emailFlags'
import { incrementPublicationIssueStat } from '@/lib/incrementStat'

const validator = new MessageValidator()

function validateSnsMessage(message: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    validator.validate(message, (err) => (err ? reject(err) : resolve()))
  })
}

/**
 * Receives SES Configuration Set events via an SNS topic subscription:
 * Bounce/Complaint open an EmailFlag (same as the Mailchimp webhook);
 * Delivery/Open/Click increment the PublicationIssue's stats. In simulated
 * mode (SES_MODE != 'live') the SNS signature check is skipped, since
 * there's no real AWS cert to verify a hand-built test payload against —
 * live mode always verifies it.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const isLive = process.env.SES_MODE === 'live'

  // SNS sends this once per subscription; confirming it is what makes the topic start delivering to us.
  if (body.Type === 'SubscriptionConfirmation') {
    try {
      if (isLive) await validateSnsMessage(body)
      if (typeof body.SubscribeURL === 'string') await fetch(body.SubscribeURL)
      return NextResponse.json({ ok: true, confirmed: true })
    } catch (err) {
      console.error('SES webhook: could not confirm SNS subscription', err)
      return NextResponse.json({ error: 'Could not confirm subscription.' }, { status: 400 })
    }
  }

  if (body.Type !== 'Notification') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  if (isLive) {
    try {
      await validateSnsMessage(body)
    } catch (err) {
      console.error('SES webhook: invalid SNS signature', err)
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
    }
  }

  const message = typeof body.Message === 'string' ? JSON.parse(body.Message) : null
  const event = parseSesEvent(message)
  if (!event) return NextResponse.json({ ok: true, ignored: true })

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  switch (event.type) {
    case 'Bounce':
      for (const email of event.emails) await flagUserByEmail(payload, email, 'cleaned', event.occurredAt)
      if (event.issueId) await incrementPublicationIssueStat(payload, event.issueId, 'stats_bounces', event.emails.length)
      break
    case 'Complaint':
      for (const email of event.emails) await flagUserByEmail(payload, email, 'spam complaint', event.occurredAt)
      if (event.issueId) await incrementPublicationIssueStat(payload, event.issueId, 'stats_complaints', event.emails.length)
      break
    case 'Delivery':
      if (event.issueId) await incrementPublicationIssueStat(payload, event.issueId, 'stats_delivered', event.emails.length)
      break
    case 'Open':
      if (event.issueId) await incrementPublicationIssueStat(payload, event.issueId, 'stats_opens', event.emails.length)
      break
    case 'Click':
      if (event.issueId) await incrementPublicationIssueStat(payload, event.issueId, 'stats_clicks', event.emails.length)
      break
    case 'Send':
      break
  }

  return NextResponse.json({ ok: true })
}

// AWS (and most webhook providers) GET the URL once to verify it exists.
export async function GET() {
  return NextResponse.json({ ok: true })
}
