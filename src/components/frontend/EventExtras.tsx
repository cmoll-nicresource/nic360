import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Event } from '@/payload-types'
import { hasRichText } from '@/lib/eventAgenda'
import {
  audienceStats,
  deadlineCountdown,
  eventHighlights,
  faqEntries,
  type KeyDate,
} from '@/lib/eventMarketing'
import { formatDate } from '@/lib/formatDate'

/** Headline figures and a short description of who is in the room. */
export function EventAudience({ event }: { event: Pick<Event, 'audience'> }) {
  const stats = audienceStats(event)
  return (
    <>
      {!!stats.length && (
        <dl className="edition-stats">
          {stats.map((stat) => (
            <div key={`${stat.value}-${stat.label}`}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {hasRichText(event.audience?.intro) && (
        <div className="edition-prose">
          <RichText data={event.audience!.intro!} />
        </div>
      )}
    </>
  )
}

/** Video, photos and delegate quotes from an event that has taken place. */
export function EventHighlights({
  event,
}: {
  event: Pick<Event, 'highlights' | 'name'>
}) {
  const { video, photos, testimonials } = eventHighlights(event)
  return (
    <div className="edition-highlights">
      {video && 'embedUrl' in video && (
        <div className="edition-highlight-video">
          <iframe
            src={video.embedUrl}
            title={`${event.name} highlights video`}
            loading="lazy"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {video && 'linkUrl' in video && (
        <p>
          <a href={video.linkUrl} target="_blank" rel="noreferrer" className="edition-text-link">
            Watch the {event.name} highlights ↗
          </a>
        </p>
      )}
      {!!photos.length && (
        <ul className="edition-highlight-photos">
          {photos.slice(0, 8).map((photo) => (
            <li key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.alt || ''} loading="lazy" />
            </li>
          ))}
        </ul>
      )}
      {!!testimonials.length && (
        <div className="edition-testimonials">
          {testimonials.map((item) => (
            <figure key={item.quote}>
              <blockquote>
                <p>{item.quote}</p>
              </blockquote>
              {(item.name || item.organisation) && (
                <figcaption>{[item.name, item.organisation].filter(Boolean).join(', ')}</figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

/** Practical questions, each opening in place. */
export function EventFaq({ event }: { event: Pick<Event, 'faq'> }) {
  return (
    <div className="edition-faq">
      {faqEntries(event).map((item) => (
        <details key={item.id ?? item.question}>
          <summary>{item.question}</summary>
          <div className="edition-prose">
            <RichText data={item.answer} />
          </div>
        </details>
      ))}
    </div>
  )
}

/** Deadlines beside the ticket prices; ones that have gone by are struck through. */
export function EventKeyDates({ dates }: { dates: KeyDate[] }) {
  if (!dates.length) return null
  return (
    <section className="edition-key-dates" aria-label="Key dates">
      <h3>Key dates</h3>
      <ul>
        {dates.map((item) => {
          const countdown = deadlineCountdown(item.daysLeft)
          return (
            <li key={`${item.label}-${item.date}`} className={item.passed ? 'is-passed' : undefined}>
              <span>{item.label}</span>
              <span>
                {formatDate(item.date)}
                {item.passed && <em> (passed)</em>}
                {countdown && <strong> {countdown}</strong>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Calendar file for Outlook and Apple, and a filled-in Google Calendar link. */
export function AddToCalendar({ icsPath, googleUrl }: { icsPath: string; googleUrl: string }) {
  return (
    <p className="edition-add-calendar">
      <span>Add to calendar</span>
      <a href={icsPath}>Outlook / Apple</a>
      <a href={googleUrl} target="_blank" rel="noreferrer">
        Google ↗
      </a>
    </p>
  )
}
