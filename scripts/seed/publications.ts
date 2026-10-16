import fs from 'fs'
import os from 'os'
import path from 'path'
import type { Payload } from 'payload'
import {
  publicationSelectionRules,
  VAPOR_PRODUCT_NAMES,
} from '../../src/lib/publicationSelectionPolicy'

import { lexicalFromText } from '../../src/lib/lexical'
import { buildSectionsFromRules } from '../../src/lib/publicationRules'
import { renderIssueEmailHtml } from '../../src/lib/issueEmail'
import { getMailchimpClient } from '../../src/lib/mailchimp'
import { adSlotCount, getActiveAdsForPublication } from '../../src/lib/publicationAds'
import { incrementAdImpressions } from '../../src/lib/adStats'
import { SITE_URL } from '../../src/lib/env'

const PLACEHOLDER_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function placeholderMedia(payload: Payload, alt: string) {
  const tmpPath = path.join(os.tmpdir(), `nic360-${alt.replace(/\W+/g, '-')}.png`)
  fs.writeFileSync(tmpPath, Buffer.from(PLACEHOLDER_PNG_BASE64, 'base64'))
  const doc = await payload.create({
    collection: 'media',
    data: { alt },
    filePath: tmpPath,
    overrideAccess: true,
  })
  fs.unlinkSync(tmpPath)
  return doc
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
}

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
  const us = await payload.find({
    collection: 'locations',
    where: { and: [{ name: { equals: 'United States' } }, { level: { equals: 'country' } }] },
    depth: 0,
    limit: 2,
    overrideAccess: true,
  })
  if (us.docs.length !== 1)
    throw new Error('Seed the United States country location before publications.')

  const { docs: vaporProductDocs } = await payload.find({
    collection: 'products',
    where: { name: { in: VAPOR_PRODUCT_NAMES } },
    limit: 100,
    overrideAccess: true,
  })
  const vaporProductIds = vaporProductDocs.map((p) => p.id)

  const defs = [
    {
      title: 'Daily Executive Summary',
      slug: 'daily-executive-summary',
      description: 'A daily roundup of the top news and legislation across the industry.',
      category: ['news'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'excerpt-list' as const,
      frequency: 'daily' as const,
      mailchimpInterestId: 'sim_interest_daily_executive_summary',
      mailchimpSegmentId: 'sim_segment_daily_executive_summary',
      selectionRules: {
        excerptTypes: ['articles', 'bills'] as ('articles' | 'bills' | 'trademarks')[],
      },
    },
    {
      title: 'Weekly Executive Summary',
      slug: 'weekly-executive-summary',
      description:
        'A weekly roundup of the top news, legislation and trademark activity across the industry.',
      category: ['news'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'excerpt-list' as const,
      frequency: 'weekly' as const,
      mailchimpInterestId: 'sim_interest_weekly_executive_summary',
      mailchimpSegmentId: 'sim_segment_weekly_executive_summary',
      selectionRules: {
        excerptTypes: ['articles', 'bills', 'trademarks'] as (
          'articles' | 'bills' | 'trademarks'
        )[],
      },
      groupingRules: { groupBy: 'sector' as const },
    },
    {
      title: 'US News Clippings',
      slug: 'us-news-clippings',
      description: 'A weekly summary of key US industry news.',
      category: ['news'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'excerpt-list' as const,
      frequency: 'weekly' as const,
      mailchimpInterestId: 'sim_interest_us_news_clippings',
      mailchimpSegmentId: 'sim_segment_us_news_clippings',
      selectionRules: {
        excerptTypes: ['articles'] as ('articles' | 'bills' | 'trademarks')[],
      },
      header:
        '<table width="100%"><tr><td style="font-size:12px;color:#666;">Nicotine360 — US News Clippings</td></tr></table>',
      footer: `<hr><p style="font-size:11px;color:#999;">You are receiving this because your company subscribes to Nicotine360. <a href="${SITE_URL}/account">Manage your preferences</a>.</p>`,
    },
    {
      title: 'Global News Clippings',
      slug: 'global-news-clippings',
      description: 'Global industry news, grouped by region and subject.',
      category: ['news'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'excerpt-list' as const,
      frequency: 'weekly' as const,
      mailchimpInterestId: 'sim_interest_global_news_clippings',
      mailchimpSegmentId: 'sim_segment_global_news_clippings',
      selectionRules: {
        excerptTypes: ['articles', 'bills'] as ('articles' | 'bills' | 'trademarks')[],
      },
      groupingRules: { groupBy: 'region' as const, thenGroupBy: 'primarySubject' as const },
    },
    {
      title: 'Vapor News Clippings',
      slug: 'vapor-news-clippings',
      description: 'A weekly summary of news specific to the vapor and e-cigarette category.',
      category: ['news'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'excerpt-list' as const,
      frequency: 'weekly' as const,
      mailchimpInterestId: 'sim_interest_vapor_news_clippings',
      mailchimpSegmentId: 'sim_segment_vapor_news_clippings',
      selectionRules: {
        excerptTypes: ['articles'] as ('articles' | 'bills' | 'trademarks')[],
        ...(vaporProductIds.length ? { products: { include: vaporProductIds } } : {}),
      },
    },
    {
      title: 'Daily US Legislative Snapshot',
      slug: 'daily-us-legislative-snapshot',
      description: 'A daily look at new and moving US federal and state legislation.',
      category: ['legislation'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'excerpt-list' as const,
      frequency: 'daily' as const,
      mailchimpInterestId: 'sim_interest_daily_us_legislative_snapshot',
      mailchimpSegmentId: 'sim_segment_daily_us_legislative_snapshot',
      selectionRules: { excerptTypes: ['bills'] as ('articles' | 'bills' | 'trademarks')[] },
    },
    {
      title: 'Weekly US Legislative Report',
      slug: 'weekly-us-legislative-report',
      description: 'A weekly summary of US federal and state legislative activity.',
      category: ['legislation'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'excerpt-list' as const,
      frequency: 'weekly' as const,
      mailchimpInterestId: 'sim_interest_weekly_us_legislative_report',
      mailchimpSegmentId: 'sim_segment_weekly_us_legislative_report',
      selectionRules: { excerptTypes: ['bills'] as ('articles' | 'bills' | 'trademarks')[] },
      groupingRules: { groupBy: 'country' as const },
    },
    {
      title: 'Monthly Research Digest',
      slug: 'monthly-research-digest',
      description: 'A monthly custom-HTML roundup designed outside the CMS.',
      category: ['news'] as ('news' | 'legislation' | 'trademarks')[],
      format: 'custom-html' as const,
      frequency: 'monthly' as const,
      mailchimpInterestId: 'sim_interest_monthly_research_digest',
      mailchimpSegmentId: 'sim_segment_monthly_research_digest',
    },
    {
      title: 'Weekly US Trademark Report',
      slug: 'weekly-us-trademark-report',
      description: 'New trademarks published for opposition in the past week.',
      category: ['trademarks'] as ('news' | 'legislation' | 'trademarks')[],
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
      category: ['trademarks'] as ('news' | 'legislation' | 'trademarks')[],
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
        category: def.category,
        format: def.format,
        frequency: def.frequency,
        generator: def.generator ?? 'manual',
        selectionRules:
          def.format === 'excerpt-list'
            ? publicationSelectionRules(def, us.docs[0].id)
            : def.selectionRules,
        groupingRules: def.groupingRules,
        header: 'header' in def ? def.header : undefined,
        footer: 'footer' in def ? def.footer : undefined,
        mailchimp: { interestId: def.mailchimpInterestId, segmentId: def.mailchimpSegmentId },
      },
      overrideAccess: true,
    })
    publications[def.slug] = doc.id
  }

  return publications
}

/** Three ranked, currently-active ads for US News Clippings — matches the worked example in docs/entity-map.md (ad 1 before story 1, ad 2 before story 3, ad 3 before story 5). */
export async function seedPublicationAds(payload: Payload, publications: Record<string, number>) {
  console.log('Seeding publication ads...')

  const publicationId = publications['us-news-clippings']
  if (!publicationId) return

  const advertisers = ['Altria', 'BAT Group', 'JUUL Labs']
  for (let i = 0; i < advertisers.length; i++) {
    const image = await placeholderMedia(payload, `${advertisers[i]} ad placeholder`)
    await payload.create({
      collection: 'publication-ads',
      data: {
        advertiser: advertisers[i],
        publication: publicationId,
        image: image.id,
        link: 'https://example.com/',
        rank: i + 1,
        startDate: daysFromNow(-30),
        endDate: daysFromNow(30),
      },
      overrideAccess: true,
    })
  }
}

/** Demonstrates the full "build from rules, then send" flow using the real code paths. */
export async function seedIssuesAndSendDemo(
  payload: Payload,
  publications: Record<string, number>,
) {
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
  // simulated outbox has a real example with full rendered HTML (header,
  // footer and interleaved ads included).
  const fullIssue = await payload.findByID({
    collection: 'publication-issues',
    id: builtIssue.id,
    depth: 1,
    overrideAccess: true,
  })
  const itemCount = (fullIssue.sections ?? []).reduce((n, s) => n + (s.items?.length ?? 0), 0)
  const ads = await getActiveAdsForPublication(payload, usNewsPub.id, adSlotCount(itemCount))
  const html = renderIssueEmailHtml(fullIssue, usNewsPub, ads)
  await Promise.all(ads.map((ad) => incrementAdImpressions(payload, ad.id)))
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
    data: {
      email: { ...fullIssue.email, campaignId, status: 'sent', sentAt: new Date().toISOString() },
    },
    overrideAccess: true,
  })
  console.log(
    `  Sent "${fullIssue.title}" (campaign ${campaignId}) — check the mailchimp-outbox collection.`,
  )

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

/**
 * A run of historical "sent" issues with realistic delivery stats for the
 * two highest-frequency publications, so the admin analytics Publications
 * tab (/admin/analytics?tab=publications) has something real to search —
 * e.g. the "last 10 Daily Executive Summaries" scenario this was built for.
 * Alternates `email.provider` between mailchimp/ses so both show up too.
 */
export async function seedPublicationEngagementHistory(
  payload: Payload,
  publications: Record<string, number>,
) {
  console.log('Seeding publication engagement history...')

  const targets = [
    { slug: 'daily-executive-summary', count: 12, frequencyDays: 1 },
    { slug: 'weekly-us-legislative-report', count: 6, frequencyDays: 7 },
  ]

  for (const target of targets) {
    const publicationId = publications[target.slug]
    if (!publicationId) continue
    const pub = await payload.findByID({
      collection: 'publications',
      id: publicationId,
      overrideAccess: true,
    })

    for (let i = 0; i < target.count; i++) {
      const issueDate = new Date(Date.now() - i * target.frequencyDays * 24 * 60 * 60 * 1000)
      const recipientCount = 900 + Math.floor(Math.random() * 100) // 900-1000, matching the real audience size
      const openRate = 0.3 + Math.random() * 0.25 // 30-55%
      const clickRate = openRate * (0.1 + Math.random() * 0.15) // a fraction of openers click
      const opens = Math.round(recipientCount * openRate)
      const clicks = Math.round(recipientCount * clickRate)
      const bounces = Math.floor(Math.random() * 6)
      const complaints = Math.random() < 0.15 ? 1 : 0
      const provider = i % 2 === 0 ? 'ses' : 'mailchimp'

      await payload.create({
        collection: 'publication-issues',
        data: {
          publication: publicationId,
          title: `${pub.title} - ${issueDate.toLocaleDateString()}`,
          issueDate: issueDate.toISOString(),
          format: 'excerpt-list',
          email: {
            subject: pub.title,
            provider,
            campaignId:
              provider === 'ses' ? `ses-seed-${target.slug}-${i}` : `sim_seed_${target.slug}_${i}`,
            status: 'sent',
            sentAt: issueDate.toISOString(),
          },
          stats: {
            recipientCount,
            delivered: recipientCount - bounces,
            opens,
            clicks,
            bounces,
            complaints,
          },
          _status: 'published',
        },
        overrideAccess: true,
      })
    }
    console.log(`  Seeded ${target.count} historical "${pub.title}" issue(s) with delivery stats.`)
  }
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
