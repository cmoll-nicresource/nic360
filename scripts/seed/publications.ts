import type { Payload } from 'payload'

import { lexicalFromText } from '../../src/lib/lexical'
import { buildSectionsFromRules } from '../../src/lib/publicationRules'
import { renderIssueEmailHtml } from '../../src/lib/issueEmail'
import { getMailchimpClient } from '../../src/lib/mailchimp'

export async function seedMailchimpSettings(payload: Payload) {
  console.log('Seeding Mailchimp settings...')
  await payload.updateGlobal({
    slug: 'mailchimp-settings',
    data: {
      audienceId: 'sim_audience_nicotine360',
      publicationsInterestCategoryId: 'sim_interest_category_publications',
    },
    overrideAccess: true,
  })
}

export async function seedPublications(payload: Payload) {
  console.log('Seeding publications...')

  const defs = [
    {
      title: 'US News Clippings',
      slug: 'us-news-clippings',
      description: 'A weekly summary of key US industry news.',
      format: 'excerpt-list' as const,
      frequency: 'weekly' as const,
      mailchimpInterestId: 'sim_interest_us_news_clippings',
      mailchimpSegmentId: 'sim_segment_us_news_clippings',
      selectionRules: {
        excerptTypes: ['articles'] as ('articles' | 'bills' | 'trademarks')[],
      },
    },
    {
      title: 'Global News Clippings',
      slug: 'global-news-clippings',
      description: 'Global industry news, grouped by region and subject.',
      format: 'excerpt-list' as const,
      frequency: 'weekly' as const,
      mailchimpInterestId: 'sim_interest_global_news_clippings',
      mailchimpSegmentId: 'sim_segment_global_news_clippings',
      selectionRules: { excerptTypes: ['articles', 'bills'] as ('articles' | 'bills' | 'trademarks')[] },
      groupingRules: { groupBy: 'region' as const, thenGroupBy: 'primarySubject' as const },
    },
    {
      title: 'Monthly Research Digest',
      slug: 'monthly-research-digest',
      description: 'A monthly custom-HTML roundup designed outside the CMS.',
      format: 'custom-html' as const,
      frequency: 'monthly' as const,
      mailchimpInterestId: 'sim_interest_monthly_research_digest',
      mailchimpSegmentId: 'sim_segment_monthly_research_digest',
    },
    {
      title: 'Weekly US Trademark Report',
      slug: 'weekly-us-trademark-report',
      description: 'New trademarks published for opposition in the past week.',
      format: 'pdf-report' as const,
      frequency: 'weekly' as const,
      generator: 'weekly-trademark-report' as const,
      mailchimpInterestId: 'sim_interest_weekly_trademark_report',
      mailchimpSegmentId: 'sim_segment_weekly_trademark_report',
    },
    {
      title: 'Monthly US Trademark Activity',
      slug: 'monthly-us-trademark-activity',
      description: 'Cancellations and renewals in the previous month.',
      format: 'pdf-report' as const,
      frequency: 'monthly' as const,
      generator: 'monthly-trademark-activity' as const,
      mailchimpInterestId: 'sim_interest_monthly_trademark_activity',
      mailchimpSegmentId: 'sim_segment_monthly_trademark_activity',
    },
  ]

  const publications: Record<string, number> = {}
  for (const def of defs) {
    const doc = await payload.create({
      collection: 'publications',
      data: {
        title: def.title,
        slug: def.slug,
        description: def.description,
        format: def.format,
        frequency: def.frequency,
        generator: def.generator ?? 'manual',
        selectionRules: def.selectionRules,
        groupingRules: def.groupingRules,
        mailchimp: { interestId: def.mailchimpInterestId, segmentId: def.mailchimpSegmentId },
      },
      overrideAccess: true,
    })
    publications[def.slug] = doc.id
  }

  return publications
}

/** Demonstrates the full "build from rules, then send" flow using the real code paths. */
export async function seedIssuesAndSendDemo(payload: Payload, publications: Record<string, number>) {
  console.log('Seeding issues (building one from rules, sending one)...')

  // 1. An excerpt-list issue, built from its publication's rules — the same
  // function the admin "Build from rules" button calls.
  const usNewsPub = await payload.findByID({
    collection: 'publications',
    id: publications['us-news-clippings'],
    overrideAccess: true,
  })
  const sections = await buildSectionsFromRules(payload, usNewsPub)
  const builtIssue = await payload.create({
    collection: 'publication-issues',
    data: {
      publication: usNewsPub.id,
      title: `${usNewsPub.title} - ${new Date().toLocaleDateString()}`,
      issueDate: new Date().toISOString(),
      format: 'excerpt-list',
      intro: lexicalFromText('This week in US tobacco and nicotine industry news.'),
      sections,
      email: { subject: usNewsPub.title, previewText: 'This week in US industry news' },
      _status: 'published',
    },
    overrideAccess: true,
  })
  console.log(`  Built "${builtIssue.title}" from rules: ${sections.length} section(s).`)

  // 2. Send it — the same code path as the admin "Send" button — so the
  // simulated outbox has a real example with full rendered HTML.
  const fullIssue = await payload.findByID({
    collection: 'publication-issues',
    id: builtIssue.id,
    depth: 1,
    overrideAccess: true,
  })
  const html = renderIssueEmailHtml(fullIssue)
  const client = getMailchimpClient(payload)
  const { campaignId } = await client.createCampaign({
    subject: fullIssue.email?.subject || fullIssue.title,
    previewText: fullIssue.email?.previewText ?? undefined,
    html,
    segmentId: usNewsPub.mailchimp?.segmentId || '',
    segmentLabel: `${usNewsPub.title} (segment ${usNewsPub.mailchimp?.segmentId})`,
  })
  await client.sendCampaign(campaignId)
  await payload.update({
    collection: 'publication-issues',
    id: builtIssue.id,
    data: { email: { ...fullIssue.email, campaignId, status: 'sent', sentAt: new Date().toISOString() } },
    overrideAccess: true,
  })
  console.log(`  Sent "${fullIssue.title}" (campaign ${campaignId}) — check the mailchimp-outbox collection.`)

  // 3. A second, not-yet-sent draft issue so staff have something to try
  // Build from rules / Send on themselves in the admin.
  await payload.create({
    collection: 'publication-issues',
    data: {
      publication: usNewsPub.id,
      title: `${usNewsPub.title} - Draft`,
      issueDate: new Date().toISOString(),
      format: 'excerpt-list',
      intro: lexicalFromText('Draft issue — try "Build from rules" and "Send" on this one.'),
      email: { subject: `${usNewsPub.title} (draft)` },
      _status: 'draft',
    },
    overrideAccess: true,
  })

  // 4. A custom-HTML issue, to show that format rendering too.
  const digestPub = await payload.findByID({
    collection: 'publications',
    id: publications['monthly-research-digest'],
    overrideAccess: true,
  })
  await payload.create({
    collection: 'publication-issues',
    data: {
      publication: digestPub.id,
      title: `${digestPub.title} - ${new Date().toLocaleDateString()}`,
      issueDate: new Date().toISOString(),
      format: 'custom-html',
      body: '<p>A hand-designed monthly roundup. <strong>Placeholder content.</strong></p>',
      email: { subject: digestPub.title },
      _status: 'published',
    },
    overrideAccess: true,
  })
}

/** A handful of EmailFlags, so the queue and Re-add button have something to show. */
export async function seedEmailFlags(payload: Payload, publications: Record<string, number>) {
  console.log('Seeding email flags...')
  const { docs: users } = await payload.find({
    collection: 'users',
    where: { email: { equals: 'ian.fletcher@bat.com' } },
    limit: 1,
    overrideAccess: true,
  })
  const user = users[0]
  if (!user) return

  await payload.create({
    collection: 'email-flags',
    data: {
      user: user.id,
      reason: 'unsubscribed',
      occurredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      publicationsBefore: [publications['us-news-clippings']],
      status: 'open',
    },
    overrideAccess: true,
  })
}
