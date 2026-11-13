import type { CSSProperties } from 'react'
import type { Sponsor } from '@/payload-types'
import { hasArtwork } from '@/lib/editorial'
import { safeExternalUrl } from '@/lib/eventAgenda'

/** Enough copies of a short list that one pass is wider than any screen. */
const MIN_ITEMS_PER_PASS = 10
/** A handful of sponsors reads better standing still than repeated to fill a moving band. */
const MIN_SPONSORS_TO_SCROLL = 5

function SponsorMark({ sponsor, focusable }: { sponsor: Sponsor; focusable: boolean }) {
  const logo = typeof sponsor.logo === 'object' ? sponsor.logo : null
  const mark = hasArtwork(logo) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo.url} alt={sponsor.name} loading="lazy" />
  ) : (
    <strong>{sponsor.name}</strong>
  )
  const href = safeExternalUrl(sponsor.website)
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" tabIndex={focusable ? undefined : -1}>
      {mark}
    </a>
  ) : (
    <span>{mark}</span>
  )
}

/**
 * The moving band of sponsor logos shown on every event marketing page. It
 * is pure CSS: two identical passes slide left by exactly one pass, so the
 * loop has no seam. It pauses under the pointer or keyboard focus, and for
 * visitors who ask for reduced motion it becomes a plain row to scroll.
 * With only a few sponsors it is a still, centred row instead.
 */
export function SponsorMarquee({
  sponsors,
  label = 'With thanks to our sponsors',
}: {
  sponsors: Sponsor[]
  label?: string
}) {
  if (!sponsors.length) return null
  if (sponsors.length < MIN_SPONSORS_TO_SCROLL)
    return (
      <section className="edition-marquee edition-marquee--still" aria-label={label}>
        <p className="edition-eyebrow">{label}</p>
        <ul>
          {sponsors.map((sponsor) => (
            <li key={sponsor.id}>
              <SponsorMark sponsor={sponsor} focusable />
            </li>
          ))}
        </ul>
      </section>
    )
  const repeats = Math.ceil(MIN_ITEMS_PER_PASS / sponsors.length)
  const pass = Array.from({ length: repeats }, () => sponsors).flat()
  return (
    <section className="edition-marquee" aria-label={label}>
      <p className="edition-eyebrow">{label}</p>
      <div className="edition-marquee-window">
        <div
          className="edition-marquee-track"
          style={{ '--marquee-seconds': `${pass.length * 4}s` } as CSSProperties}
        >
          <ul>
            {pass.map((sponsor, index) => (
              <li key={`${sponsor.id}-${index}`} aria-hidden={index >= sponsors.length || undefined}>
                <SponsorMark sponsor={sponsor} focusable={index < sponsors.length} />
              </li>
            ))}
          </ul>
          <ul aria-hidden="true">
            {pass.map((sponsor, index) => (
              <li key={`${sponsor.id}-${index}`}>
                <SponsorMark sponsor={sponsor} focusable={false} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
