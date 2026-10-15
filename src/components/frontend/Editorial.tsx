import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import type { Article, Event, Guide, Publication, PublicationIssue } from '@/payload-types'
import { CHANNELS } from '@/config/channels'
import { formatDate } from '@/lib/formatDate'
import { excerptSummary, hasArtwork, hasDistinctExcerpt, sourceLabel } from '@/lib/editorial'
import { sentenceCase } from '@/lib/textCase'
import { eventPhotoKey } from '@/config/editorialPhotos'
import { EditorialPhoto } from './EditorialPhoto'

export function SectionHeading({
  eyebrow,
  title,
  href,
  action = 'View all',
  children,
}: {
  eyebrow?: string
  title: string
  href?: string
  action?: string
  children?: ReactNode
}) {
  return (
    <div className="edition-section-heading">
      <div>
        {eyebrow && <p className="edition-eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {children}
      </div>
      {href && (
        <Link href={href}>
          {action} <span aria-hidden="true">↗</span>
        </Link>
      )}
    </div>
  )
}

export function NewsRow({ article, summary = false }: { article: Article; summary?: boolean }) {
  const subject = typeof article.primarySubject === 'object' ? article.primarySubject?.name : null
  return (
    <Link href={`/articles/${article.id}`} className="edition-news-row">
      <div className="edition-meta">
        {sourceLabel(typeof article.source === 'object' ? article.source?.name : null)}
        {subject && <span>{sentenceCase(subject)}</span>}
      </div>
      <h3>{article.title}</h3>
      {summary && hasDistinctExcerpt(article.excerpt, article.title) && (
        <p className="edition-summary">{excerptSummary(article.excerpt)}</p>
      )}
      <span className="edition-row-arrow" aria-hidden="true">
        ↗
      </span>
    </Link>
  )
}

export function PublicationCover({
  publication,
  date,
  compact = false,
}: {
  publication: Pick<Publication, 'title' | 'frequency' | 'thumbnail' | 'generator'>
  date?: string
  compact?: boolean
}) {
  const thumbnail = typeof publication.thumbnail === 'object' ? publication.thumbnail : null
  if (hasArtwork(thumbnail))
    return (
      <div className={`edition-cover${compact ? ' edition-cover--compact' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnail.url} alt="" />
      </div>
    )
  const tradeCover = publication.generator === 'monthly-trade-barometer'
  return (
    <div
      className={`edition-cover${compact ? ' edition-cover--compact' : ''}${tradeCover ? ' edition-cover--photo' : ''}`}
    >
      {tradeCover && (
        <EditorialPhoto
          photo="shipping"
          className="editorial-cover-photo"
          decorative
          sizes="(max-width: 600px) 200px, 400px"
        />
      )}
      <span className="edition-cover-brand">Nicotine360</span>
      <span className="edition-cover-rule" />
      <strong>{publication.title}</strong>
      <span className="edition-cover-bottom">
        {date ? formatDate(date) : `${publication.frequency} intelligence`}
      </span>
    </div>
  )
}

export function IssueCard({ issue }: { issue: PublicationIssue }) {
  const publication = typeof issue.publication === 'object' ? issue.publication : null
  if (!publication) return null
  return (
    <Link
      className="edition-issue-card"
      href={`/publications/${publication.slug}/issues/${issue.id}`}
    >
      <PublicationCover publication={publication} date={issue.issueDate} compact />
      <div>
        <p className="edition-eyebrow">
          {publication.frequency} · {issue.format === 'pdf-report' ? 'PDF report' : 'Briefing'}
        </p>
        <h3>{issue.title}</h3>
        <p className="edition-meta">{formatDate(issue.issueDate)}</p>
        <span className="edition-text-link">Read issue ↗</span>
      </div>
    </Link>
  )
}

export function GuideCover({ guide }: { guide: Pick<Guide, 'title' | 'thumbnail'> }) {
  const image = typeof guide.thumbnail === 'object' ? guide.thumbnail : null
  return hasArtwork(image) ? (
    <div className="edition-guide-cover">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt="" />
    </div>
  ) : (
    <div className="edition-guide-cover edition-guide-cover--type">
      <span>NICOTINE360 / REFERENCE</span>
      <strong>{guide.title}</strong>
      <span>Tax · Trade · Regulation</span>
    </div>
  )
}

export function EventVisual({ event, eager = false }: { event: Event; eager?: boolean }) {
  const image = typeof event.image === 'object' ? event.image : null
  const channel = CHANNELS[event.channel]
  const suppliedPhoto = eventPhotoKey(event)
  return (
    <div
      className="edition-event-visual"
      style={{ '--event-color': channel.brandColor } as CSSProperties}
    >
      {hasArtwork(image) ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.alt || ''} />
        </>
      ) : suppliedPhoto ? (
        <EditorialPhoto
          photo={suppliedPhoto}
          className="editorial-event-photo"
          eager={eager}
          sizes="(max-width: 900px) 100vw, 560px"
        />
      ) : (
        <>
          <span>
            {channel.format === 'online' ? 'ONLINE CONVERSATIONS' : 'INDUSTRY CONNECTIONS'}
          </span>
          <strong>{channel.name}</strong>
          <span>{formatDate(event.startsAt)}</span>
        </>
      )}
    </div>
  )
}

export function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event.id}`} className="edition-event-card">
      <EventVisual event={event} />
      <div>
        <p className="edition-eyebrow">
          {CHANNELS[event.channel].name} · {formatDate(event.startsAt)}
        </p>
        <h3>{event.name}</h3>
        {event.venue?.address && <p className="muted">{event.venue.address}</p>}
        {event.tagline && <p>{event.tagline}</p>}
        <span className="edition-text-link">Explore the event ↗</span>
      </div>
    </Link>
  )
}

export function AccessPanel({
  title = 'Your next insight starts here.',
  description = 'Sign in with your work email to use your company’s subscription.',
  premium = false,
}: {
  title?: string
  description?: string
  premium?: boolean
}) {
  return (
    <div className="edition-access">
      <span className="edition-eyebrow">
        {premium ? 'PREMIUM INTELLIGENCE' : 'MEMBER INTELLIGENCE'}
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="edition-actions">
        <Link href="/login" className="btn">
          Sign in
        </Link>
        <Link href="/signup" className="btn btn-secondary">
          Check your access
        </Link>
      </div>
    </div>
  )
}
