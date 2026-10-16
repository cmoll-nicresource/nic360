import { NextResponse } from 'next/server'
import type { Payload, PayloadRequest } from 'payload'

import { requireStaff } from '@/lib/requireStaff'
import { incrementAdImpressions } from '@/lib/adStats'
import { renderIssueEmailHtml } from '@/lib/issueEmail'
import { getMailchimpClient } from '@/lib/mailchimp'
import { adSlotCount, getActiveAdsForPublication } from '@/lib/publicationAds'
import { getSesClient } from '@/lib/ses'
import { getPublicationRecipients } from '@/lib/publicationRecipients'
import type { Publication, PublicationAd, PublicationIssue } from '@/payload-types'
import { NewsletterError, queueNewsletter } from '@/lib/ses/sendIssue'
import { emailSafeModeRedirectAddress, isEmailSafeModeEnabled } from '@/lib/emailSafeMode'
import { newsletterLiveConfig } from '@/lib/ses/live'

/** Which sender actually ships publication email — see docs/entity-map.md's Email delivery section. */
function emailProvider(): 'mailchimp' | 'ses' {
  return process.env.EMAIL_PROVIDER === 'mailchimp' ? 'mailchimp' : 'ses'
}

// pdf-report issues have no "story" list to slot ads between, so instead of
// a real item count we just allow a flat handful of ad slots.
const PDF_REPORT_AD_ITEM_CAP = 10

type SendArgs = {
  payload: Payload
  user: PayloadRequest['user']
  issue: PublicationIssue
  publication: Publication
  subject: string
  html: string
  ads: PublicationAd[]
  isTest: boolean
  testEmail?: string
  recover?: boolean
}

/** Counts this send as one "impression" per ad placed — not reader-level opens; see PublicationAd.stats' description. Skipped for test sends. */
async function recordAdImpressions(payload: Payload, ads: PublicationAd[], isTest: boolean) {
  if (isTest) return
  await Promise.all(ads.map((ad) => incrementAdImpressions(payload, ad.id)))
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const { payload, user } = await requireStaff('editor')

    const body = (await request.json().catch(() => ({}))) as {
      test?: boolean
      testEmail?: string
      recover?: boolean
    }
    const isTest = Boolean(body.test)

    const issue = (await payload
      .findByID({ collection: 'publication-issues', id, depth: 2, overrideAccess: true })
      .catch(() => null)) as PublicationIssue | null
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    if (!isTest && issue._status !== 'published')
      return NextResponse.json(
        { error: 'Publish this issue before sending it to readers.' },
        { status: 409 },
      )

    if (!isTest && issue.email?.status === 'sent') {
      return NextResponse.json(
        { error: 'This issue has already been sent and is locked against re-sending.' },
        { status: 400 },
      )
    }

    const publication = typeof issue.publication === 'object' ? issue.publication : null
    if (!publication) return NextResponse.json({ error: 'Publication not found.' }, { status: 404 })

    const adItemCount =
      issue.format === 'excerpt-list'
        ? (issue.sections ?? []).reduce((n, s) => n + (s.items?.length ?? 0), 0)
        : issue.format === 'pdf-report'
          ? PDF_REPORT_AD_ITEM_CAP
          : 0
    const ads = await getActiveAdsForPublication(payload, publication.id, adSlotCount(adItemCount))

    const args: SendArgs = {
      payload,
      user,
      issue,
      publication,
      subject: issue.email?.subject || issue.title,
      html: renderIssueEmailHtml(issue, publication, ads),
      ads,
      isTest,
      testEmail: body.testEmail,
      recover: body.recover === true,
    }

    return emailProvider() === 'ses' ? await sendViaSes(args) : await sendViaMailchimp(args)
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof NewsletterError)
      return NextResponse.json({ error: err.message }, { status: err.status })
    console.error(err)
    return NextResponse.json({ error: 'Failed to send issue.' }, { status: 500 })
  }
}

async function sendViaMailchimp({
  payload,
  user,
  issue,
  publication,
  subject,
  html,
  ads,
  isTest,
  testEmail,
}: SendArgs) {
  const client = getMailchimpClient(payload)

  if (isTest) {
    if (!testEmail) return NextResponse.json({ error: 'testEmail is required.' }, { status: 400 })
    await client.sendTest(
      {
        subject,
        previewText: issue.email?.previewText ?? undefined,
        html,
        segmentId: '',
        segmentLabel: 'test',
      },
      testEmail,
    )
    return NextResponse.json({ sent: 'test', testEmail })
  }

  const segmentId = publication.mailchimp?.segmentId || ''
  const segmentLabel = `${publication.title}${segmentId ? ` (segment ${segmentId})` : ' (no segment configured)'}`

  try {
    const { campaignId } = await client.createCampaign({
      subject,
      previewText: issue.email?.previewText ?? undefined,
      html,
      segmentId,
      segmentLabel,
    })
    await client.sendCampaign(campaignId)
    await recordAdImpressions(payload, ads, isTest)

    const updated = await payload.update({
      collection: 'publication-issues',
      context: { newsletterSystem: true },
      id: issue.id,
      data: {
        email: {
          ...issue.email,
          provider: 'mailchimp',
          campaignId,
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentBy: user && 'collection' in user && user.collection === 'staff' ? user.id : undefined,
        },
      },
      overrideAccess: true,
    })

    return NextResponse.json({ sent: 'campaign', campaignId, segmentLabel, issue: updated })
  } catch (sendErr) {
    await payload.update({
      collection: 'publication-issues',
      context: { newsletterSystem: true },
      id: issue.id,
      data: { email: { ...issue.email, status: 'failed' } },
      overrideAccess: true,
    })
    throw sendErr
  }
}

async function sendViaSes({
  payload,
  user,
  issue,
  publication,
  subject,
  html,
  ads,
  isTest,
  testEmail,
  recover,
}: SendArgs) {
  if (process.env.SES_MODE === 'live')
    try {
      newsletterLiveConfig()
    } catch (error) {
      throw new NewsletterError(
        error instanceof Error ? error.message : 'SES configuration is incomplete.',
        503,
      )
    }
  const client = getSesClient(payload)

  if (isTest) {
    if (!testEmail) return NextResponse.json({ error: 'testEmail is required.' }, { status: 400 })
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(testEmail))
      return NextResponse.json({ error: 'Enter one valid test email address.' }, { status: 400 })
    const result = await client.sendBulk({
      issueId: issue.id,
      subject: `[TEST] ${subject}`,
      html,
      recipients: [{ email: testEmail }],
      test: true,
    })
    return NextResponse.json({
      sent: 'test',
      messageIds: result.messageIds,
      testEmail: isEmailSafeModeEnabled() ? emailSafeModeRedirectAddress() : testEmail,
      mode: process.env.SES_MODE === 'live' ? 'live' : 'simulated',
    })
  }

  if (process.env.SES_MODE === 'live') {
    return NextResponse.json(
      await queueNewsletter(
        payload,
        issue.id,
        subject,
        html,
        user?.collection === 'staff' ? user.id : undefined,
        ads.map((a) => a.id),
        recover,
      ),
      { status: 202 },
    )
  }

  const recipients = await getPublicationRecipients(payload, publication.id)
  const { messageCount } = await client.sendBulk({ issueId: issue.id, subject, html, recipients })
  return NextResponse.json({ sent: 'simulated', mode: 'simulated', recipientCount: messageCount })
}
