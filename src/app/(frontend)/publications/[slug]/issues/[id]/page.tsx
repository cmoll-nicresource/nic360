import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getPayload } from 'payload'
import React from 'react'
import { SiteNav } from '@/components/SiteNav'
import { PublicationCover } from '@/components/frontend/Editorial'

import config from '@/payload.config'
import { getReaderPlan, planSatisfies } from '@/access/readerPlan'
import { staffHasRole } from '@/access/staffRoles'
import { adSlotCount, getActiveAdsForPublication, isAdSlotBeforeIndex } from '@/lib/publicationAds'
import { formatDate } from '@/lib/formatDate'
import type { PublicationAd } from '@/payload-types'

export const dynamic = 'force-dynamic'

const EXCERPT_PATH: Record<string, string> = {
  articles: 'articles',
  bills: 'bills',
  trademarks: 'trademarks',
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const isStaff = staffHasRole(user, 'editor')
  const plan =
    user && 'collection' in user && user.collection === 'users'
      ? await getReaderPlan(user, payload)
      : 'none'
  const canRead = isStaff || planSatisfies(plan, 'base')

  return (
    <>
      <SiteNav />
      <div className="page edition-issue-reading">
        {!canRead ? (
          <div className="locked-content">
            Sign in with a Base or Premium subscription to view this issue.{' '}
            <Link href="/account">Sign in</Link>
          </div>
        ) : (
          <IssueDetail payload={payload} id={id} isStaff={isStaff} slug={slug} />
        )}
      </div>
    </>
  )
}

// pdf-report issues have no "story" list to slot ads between, so instead of
// a real item count we just allow a flat handful of ad slots — matches the
// email renderer's PDF_REPORT_AD_ITEM_CAP.
const PDF_REPORT_AD_ITEM_CAP = 10

function AdCard({ ad }: { ad: PublicationAd }) {
  const image = typeof ad.image === 'object' ? ad.image : null
  if (!image?.url) return null
  return (
    <div className="nic-ad">
      <a href={`/api/ads/${ad.id}/click`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-uploaded ad art of arbitrary size/host; a plain <img> avoids Next's image-domain config for this one case */}
        <img
          src={image.url}
          alt={image.alt || 'Advertisement'}
          style={{ maxWidth: '100%', display: 'block' }}
        />
      </a>
    </div>
  )
}

/**
 * Renders sections as a flat sequence of headings/lists/ads, flattening the
 * item count across the whole issue (not restarted per section) — same
 * placement rule as the email renderer in src/lib/issueEmail.ts.
 */
function renderSectionsWithAds(
  sections: { heading: string; items?: { relationTo: string; value: unknown }[] | null }[],
  ads: PublicationAd[],
): React.ReactNode[] {
  let itemIndex = 0
  let adIndex = 0
  let listKey = 0
  let currentList: React.ReactNode[] = []
  const output: React.ReactNode[] = []

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      output.push(<ul key={`ul-${key}`}>{currentList}</ul>)
      currentList = []
    }
  }

  sections.forEach((section, si) => {
    output.push(<h3 key={`h-${si}`}>{section.heading}</h3>)

    ;(section.items ?? []).forEach((item, ii) => {
      if (isAdSlotBeforeIndex(itemIndex) && adIndex < ads.length) {
        flushList(`${si}-${listKey++}`)
        output.push(<AdCard key={`ad-${adIndex}`} ad={ads[adIndex]} />)
        adIndex++
      }

      if (
        typeof item.value === 'object' &&
        item.value &&
        'id' in item.value &&
        'title' in item.value
      ) {
        const value = item.value as { id: number; title: string }
        const href = `/${EXCERPT_PATH[item.relationTo]}/${value.id}`
        currentList.push(
          <li key={`item-${si}-${ii}`}>
            <Link href={href}>{value.title}</Link>
          </li>,
        )
      }
      itemIndex++
    })

    flushList(`${si}-${listKey++}`)
  })

  return output
}

async function IssueDetail({
  payload,
  id,
  isStaff,
  slug,
}: {
  payload: Awaited<ReturnType<typeof getPayload>>
  id: string
  isStaff: boolean
  slug: string
}) {
  const issue = await payload
    .findByID({ collection: 'publication-issues', id, depth: 1, overrideAccess: true })
    .catch(() => null)
  if (!issue) notFound()
  if (issue._status !== 'published' && !isStaff) notFound()

  const file = issue.file && typeof issue.file === 'object' ? issue.file : null
  const publication = typeof issue.publication === 'object' ? issue.publication : null
  if (publication?.slug !== slug) notFound()

  const adItemCount =
    issue.format === 'excerpt-list'
      ? (issue.sections ?? []).reduce((n, s) => n + (s.items?.length ?? 0), 0)
      : issue.format === 'pdf-report'
        ? PDF_REPORT_AD_ITEM_CAP
        : 0
  const ads = publication
    ? await getActiveAdsForPublication(payload, publication.id, adSlotCount(adItemCount))
    : []

  return (
    <>
      <div className="breadcrumbs">
        <Link href="/publications">Publications</Link>
        <span className="sep">/</span>
        <Link href={`/publications/${slug}`}>{publication?.title ?? slug}</Link>
      </div>

      {publication?.header && <div dangerouslySetInnerHTML={{ __html: publication.header }} />}

      <h1>{issue.title}</h1>
      <p className="excerpt-meta">
        {formatDate(issue.issueDate)}
        {isStaff ? <span className="dot">·</span> : null}
        {isStaff ? (issue.email?.status ?? 'not sent') : null}
      </p>

      {issue.format === 'excerpt-list' && (
        <div className="card">
          {issue.intro && <RichText data={issue.intro} />}
          {renderSectionsWithAds(issue.sections ?? [], ads)}
        </div>
      )}

      {issue.format === 'pdf-report' && (
        <div className="card">
          {publication && (
            <PublicationCover publication={publication} date={issue.issueDate} compact />
          )}
          {issue.summary && <RichText data={issue.summary} />}
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} />
          ))}
          {file?.url && (
            <p>
              <a href={file.url} className="btn">
                Download report (PDF) ↓
              </a>
            </p>
          )}
        </div>
      )}

      {issue.format === 'custom-html' && issue.body && (
        <div className="card" dangerouslySetInnerHTML={{ __html: issue.body }} />
      )}

      {publication?.footer && <div dangerouslySetInnerHTML={{ __html: publication.footer }} />}
    </>
  )
}
