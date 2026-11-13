import type { Event } from '@/payload-types'
import type { AgendaDay } from '@/lib/eventAgenda'
import { sessionPeople } from '@/lib/eventAgenda'
import { formatClockRange, zoneAbbreviation } from '@/lib/sessionTime'

const dayHeading = (date: string) =>
  new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

/** The full agenda: sessions by day with times, rooms and people linked to their bios. */
export function EventAgenda({
  days,
  event,
  registered,
  speakerIds,
}: {
  days: AgendaDay[]
  event: Pick<Event, 'timezone' | 'hasReplay'>
  registered: boolean
  /** Speakers with a bio on this page; other names are shown without a link. */
  speakerIds: Set<number>
}) {
  const zone = days.length ? zoneAbbreviation(days[0].date, event.timezone) : ''
  const anyTimes = days.some((day) => day.sessions.some((session) => session.startTime))
  return (
    <>
      {anyTimes && zone && (
        <p className="edition-meta">All times are local to the venue ({zone}).</p>
      )}
      {event.hasReplay && !registered && (
        <p className="edition-meta">Session replays are available to registered attendees.</p>
      )}
      {days.map((day) => (
        <section className="edition-agenda-day" key={day.key} aria-labelledby={`day-${day.key}`}>
          <h3 id={`day-${day.key}`}>
            {dayHeading(day.date)}
            {day.name && <span>{day.name}</span>}
          </h3>
          {day.sessions.map((session) => {
            const time = formatClockRange(session.startTime, session.endTime)
            const sponsors = (session.sponsors ?? [])
              .map((s) => (typeof s === 'object' ? s.name : ''))
              .filter(Boolean)
            return (
              <article
                className={`edition-session${session.type === 'Break' ? ' edition-session--break' : ''}`}
                key={session.id}
              >
                <div className="edition-session-date">
                  {time || 'Time to be confirmed'}
                  <span>
                    {session.type === 'Other' ? '' : session.type}
                    {session.type !== 'Other' && session.room ? ' · ' : ''}
                    {session.room || ''}
                  </span>
                </div>
                <div>
                  <h4>{session.title}</h4>
                  {session.description && <p>{session.description}</p>}
                  {sessionPeople(session).map((group) => (
                    <p className="edition-session-people" key={group.label}>
                      <span>{group.label}</span>
                      {group.speakers.map((speaker, index) => (
                        <span key={speaker.id}>
                          {index > 0 && ', '}
                          {speakerIds.has(speaker.id) ? (
                            <a href={`#speaker-${speaker.id}`}>{speaker.name}</a>
                          ) : (
                            speaker.name
                          )}
                          {speaker.company ? ` (${speaker.company})` : ''}
                        </span>
                      ))}
                    </p>
                  ))}
                  {!!sponsors.length && (
                    <p className="edition-meta">Supported by {sponsors.join(', ')}</p>
                  )}
                  {event.hasReplay &&
                    session.type !== 'Break' &&
                    registered &&
                    session.replayEmbed && (
                      <div
                        className="edition-replay"
                        dangerouslySetInnerHTML={{ __html: session.replayEmbed }}
                      />
                    )}
                </div>
              </article>
            )
          })}
        </section>
      ))}
    </>
  )
}
