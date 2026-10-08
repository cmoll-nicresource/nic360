import { NextResponse } from 'next/server'

import { requireStaff } from '@/lib/requireStaff'
import { renderIssueEmailHtml } from '@/lib/issueEmail'
import { getMailchimpClient } from '@/lib/mailchimp'
import type { PublicationIssue } from '@/payload-types'

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

    const html = renderIssueEmailHtml(issue)
    const subject = issue.email?.subject || issue.title
    const client = getMailchimpClient(payload)

    if (isTest) {
      if (!body.testEmail) return NextResponse.json({ error: 'testEmail is required.' }, { status: 400 })
      await client.sendTest(
        { subject, previewText: issue.email?.previewText ?? undefined, html, segmentId: '', segmentLabel: 'test' },
        body.testEmail,
      )
      return NextResponse.json({ sent: 'test', testEmail: body.testEmail })
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

      const updated = await payload.update({
        collection: 'publication-issues',
        id,
        data: {
          email: {
            ...issue.email,
            campaignId,
            status: 'sent',
            sentAt: new Date().toISOString(),
            sentBy: user?.collection === 'staff' ? user.id : undefined,
          },
        },
        overrideAccess: true,
      })

      return NextResponse.json({ sent: 'campaign', campaignId, segmentLabel, issue: updated })
    } catch (sendErr) {
      await payload.update({
        collection: 'publication-issues',
        id,
        data: { email: { ...issue.email, status: 'failed' } },
        overrideAccess: true,
      })
      throw sendErr
    }
  } catch (err) {
    if (err instanceof Response) return err
    console.error(err)
    return NextResponse.json({ error: 'Failed to send issue.' }, { status: 500 })
  }
}
