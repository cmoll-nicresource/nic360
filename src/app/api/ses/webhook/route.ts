import { getPayload } from 'payload'
import { NextResponse } from 'next/server'
import MessageValidator from 'sns-validator'

import config from '@/payload.config'
import { parseSesEvent } from '@/lib/ses'
import { flagUserByEmail } from '@/lib/emailFlags'
import { incrementPublicationIssueStat } from '@/lib/incrementStat'
import { allowLocalWebhookSimulation } from '@/lib/localSafety'
import { snsSubscriptionUrl } from '@/lib/snsSubscriptionUrl'

const validator = new MessageValidator()

function validateSnsMessage(message: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    validator.validate(message, (err) => (err ? reject(err) : resolve()))
  })
}

/**
 * Receives SES Configuration Set events via an SNS topic subscription:
 * Bounce/Complaint open an EmailFlag (same as the Mailchimp webhook);
 * Delivery/Open/Click increment the PublicationIssue's stats. Hosted
 * environments always require the configured topic and a valid signature,
 * independently of the sending mode. Local unsigned fixtures require opt-in.
 */
export async function POST(request: Request) {
  const raw = await request.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return NextResponse.json({ error: 'Invalid SNS message.' }, { status: 400 })

  const simulated = allowLocalWebhookSimulation(request)
  if (!simulated) {
    const topic = process.env.SES_SNS_TOPIC_ARN
    if (!topic)
      return NextResponse.json({ error: 'SES webhook topic is not configured.' }, { status: 503 })
    if (body.TopicArn !== topic)
      return NextResponse.json({ error: 'Unexpected SNS topic.' }, { status: 403 })
    try {
      await validateSnsMessage(body)
    } catch {
      return NextResponse.json({ error: 'Invalid SNS signature.' }, { status: 400 })
    }
  }

  // SNS sends this once per subscription; confirming it is what makes the topic start delivering to us.
  if (body.Type === 'SubscriptionConfirmation') {
    try {
      const response = await fetch(snsSubscriptionUrl(body), {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new Error('SNS confirmation failed')
      return NextResponse.json({ ok: true, confirmed: true })
    } catch (err) {
      console.error('SES webhook: could not confirm SNS subscription', err)
      return NextResponse.json({ error: 'Could not confirm subscription.' }, { status: 400 })
    }
  }

  if (body.Type !== 'Notification') {
    return NextResponse.json({ ok: true, ignored: true })
  }

  let message: unknown
  try {
    message = typeof body.Message === 'string' ? JSON.parse(body.Message) : null
  } catch {
    return NextResponse.json({ error: 'Invalid notification JSON.' }, { status: 400 })
  }
  const event = parseSesEvent(message)
  if (!event) return NextResponse.json({ ok: true, ignored: true })

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  switch (event.type) {
    case 'Bounce':
      for (const email of event.emails)
        await flagUserByEmail(payload, email, 'cleaned', event.occurredAt)
      if (event.issueId)
        await incrementPublicationIssueStat(
          payload,
          event.issueId,
          'stats_bounces',
          event.emails.length,
        )
      break
    case 'Complaint':
      for (const email of event.emails)
        await flagUserByEmail(payload, email, 'spam complaint', event.occurredAt)
      if (event.issueId)
        await incrementPublicationIssueStat(
          payload,
          event.issueId,
          'stats_complaints',
          event.emails.length,
        )
      break
    case 'Delivery':
      if (event.issueId)
        await incrementPublicationIssueStat(
          payload,
          event.issueId,
          'stats_delivered',
          event.emails.length,
        )
      break
    case 'Open':
      if (event.issueId)
        await incrementPublicationIssueStat(
          payload,
          event.issueId,
          'stats_opens',
          event.emails.length,
        )
      break
    case 'Click':
      if (event.issueId)
        await incrementPublicationIssueStat(
          payload,
          event.issueId,
          'stats_clicks',
          event.emails.length,
        )
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
