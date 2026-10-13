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

/** Which sender actually ships publication email — see docs/entity-map.md's Email delivery section. */
function emailProvider(): 'mailchimp' | 'ses' {
  return process.env.EMAIL_PROVIDER === 'ses' ? 'ses' : 'mailchimp'
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

    const body = (await request.json().catch(() => ({}))) as { test?: boolean; testEmail?: string }
    const isTest = Boolean(body.test)

    const issue = (await payload
      .findByID({ collection: 'publication-issues', id, depth: 1, overrideAccess: true })
      .catch(() => null)) as PublicationIssue | null
    if (!issue) return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })

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
    }

    return emailProvider() === 'ses' ? await sendViaSes(args) : await sendViaMailchimp(args)
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to send issue.' }, { status: 500 })
  }
}

async function sendViaMailchimp({ payload, user, issue, publication, subject, html, ads, isTest, testEmail }: SendArgs) {
  const client = getMailchimpClient(payload)

  if (isTest) {
    if (!testEmail) return NextResponse.json({ error: 'testEmail is required.' }, { status: 400 })
    await client.sendTest(
      { subject, previewText: issue.email?.previewText ?? undefined, html, segmentId: '', segmentLabel: 'test' },
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
      id: issue.id,
      data: { email: { ...issue.email, status: 'failed' } },
      overrideAccess: true,
    })
    throw sendErr
  }
}

async function sendViaSes({ payload, user, issue, publication, subject, html, ads, isTest, testEmail }: SendArgs) {
  const client = getSesClient(payload)

  if (isTest) {
    if (!testEmail) return NextResponse.json({ error: 'testEmail is required.' }, { status: 400 })
    await client.sendBulk({ issueId: issue.id, subject: `[TEST] ${subject}`, html, recipients: [{ email: testEmail }] })
    return NextResponse.json({ sent: 'test', testEmail })
  }

  try {
    const recipients = await getPublicationRecipients(payload, publication.id)
    const { messageCount } = await client.sendBulk({ issueId: issue.id, subject, html, recipients })
    await recordAdImpressions(payload, ads, isTest)

    const updated = await payload.update({
      collection: 'publication-issues',
      id: issue.id,
      data: {
        email: {
          ...issue.email,
          provider: 'ses',
          campaignId: `ses-${issue.id}-${Date.now()}`,
          status: 'sent',
          sentAt: new Date().toISOString(),
          sentBy: user && 'collection' in user && user.collection === 'staff' ? user.id : undefined,
        },
        stats: { ...issue.stats, recipientCount: messageCount },
      },
      overrideAccess: true,
    })

    return NextResponse.json({ sent: 'bulk', recipientCount: messageCount, issue: updated })
  } catch (sendErr) {
    await payload.update({
      collection: 'publication-issues',
      id: issue.id,
      data: { email: { ...issue.email, status: 'failed' } },
      overrideAccess: true,
    })
    throw sendErr
  }
}
