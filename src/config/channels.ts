export type ChannelKey = 'atnf' | 'gtnf' | 'infocus'

export type ChannelFormat = 'in-person' | 'online' | 'hybrid'

export type Channel = {
  key: ChannelKey
  name: string
  /** Spelled-out name for page titles and the channel home page. */
  fullName: string
  /** One sentence shown under the name on the channel home page and in search results. */
  summary: string
  /** "About" paragraphs for the channel home page. */
  about: string[]
  /** Where the forum has been held, oldest first. Optional. */
  hostHistory?: string[]
  brandColor: string
  homepagePath: string
  contactEmail: string
  mediaEmail?: string
  social?: { label: string; url: string }[]
  format: ChannelFormat
}

const CONFERENCE_SOCIAL = [
  { label: 'LinkedIn', url: 'https://www.linkedin.com/company/gtnfconferences/' },
  { label: 'X', url: 'https://twitter.com/thegtnf' },
]

/**
 * Events belong to a channel, which sets their brand color, home page copy
 * and contact details. These change so rarely they live in code rather than
 * a collection; the event stores only the channel key. Anything that changes
 * from year to year (dates, venue, agenda, sponsorship packages) belongs on
 * the event instead.
 */
export const CHANNELS: Record<ChannelKey, Channel> = {
  atnf: {
    key: 'atnf',
    name: 'ATNF',
    fullName: 'The American Tobacco and Nicotine Forum',
    summary:
      'The American Tobacco and Nicotine Forum (ATNF) is the country’s leading annual conference discussing the future of the tobacco and nicotine industries.',
    about: [
      'For the first century of our existence, we were TMA. Starting with a small gathering of cigar executives frustrated by competitive dynamics around trademarks and the need for more information on legislative, regulatory, economic, and product development issues, they founded TMA. In 1916 we held our first Annual Meeting at the Willard Hotel in Washington, DC.',
      'For more than a century, TMA held its meetings and did just that. Starting in 2025, our membership voted on some big changes to harmonize our conferences and we became ATNF and now stand alongside our global sister conference, GTNF. Through all the changes some things remained the same: our commitment to convening stakeholders who agree and disagree with us to bring together the people and ideas needed to help our delegates gain inspiration and understanding.',
      'ATNF is part of the Nicotine Resource Consortium, the successor to the TMA. The Consortium’s mission is simple: Convene and Inform. To do that, we stand apart from other associations. We are prohibited from lobbying and advocating. Our forums, like ATNF, are content neutral. We do not seek simply to advance an agenda. We create agendas that explore topics through diverse opinions, confronting facts, and remaining open and respectful of the diversity of thought and solutions available to tobacco and nicotine issues.',
    ],
    brandColor: 'rgb(56, 152, 236)',
    homepagePath: '/events/channels/atnf',
    contactEmail: 'atnf@nicotine360.org',
    mediaEmail: 'media@atnf.forum',
    social: CONFERENCE_SOCIAL,
    format: 'hybrid',
  },
  gtnf: {
    key: 'gtnf',
    name: 'GTNF',
    fullName: 'The Global Tobacco and Nicotine Forum',
    summary:
      'The Global Tobacco and Nicotine Forum (GTNF) is the world’s leading annual conference discussing the future of the tobacco and nicotine industries.',
    about: [
      'GTNF is the global exchange for views and ideas between public health experts, government representatives, the industry and investors.',
      'It was founded in Rio de Janeiro in 2008 to promote dialogue and shape the future together. Since then, it has traveled the world to accomplish the same.',
      'Each year, the GTNF features a growing lineup of influential voices charting historic transformation. We aspire to offer more expert panels, more keynote speakers and more diverse viewpoints than ever before.',
    ],
    hostHistory: [
      'Rio de Janeiro, Brazil (2008)',
      'Bangalore, India (2010)',
      'Antwerp, Belgium (2012)',
      'Cape Town, South Africa (2013)',
      'West Virginia, USA (2014)',
      'Bologna, Italy (2015)',
      'Brussels, Belgium (2016)',
      'New York City, USA (2017)',
      'London, U.K. (2018)',
      'Washington, D.C., USA (2019)',
      'Global/Virtual (2020)',
      'London, U.K. (2021)',
      'Washington, D.C., USA (2022)',
      'Seoul, South Korea (2023)',
      'Athens, Greece (2024)',
      'Brussels, Belgium (2025)',
      'Lisbon, Portugal (2026)',
    ],
    brandColor: 'rgb(139, 110, 177)',
    homepagePath: '/events/channels/gtnf',
    contactEmail: 'gtnf@nicotine360.org',
    mediaEmail: 'media@gtnf.org',
    social: CONFERENCE_SOCIAL,
    format: 'hybrid',
  },
  infocus: {
    key: 'infocus',
    name: 'InFocus',
    fullName: 'InFocus',
    summary:
      'InFocus is a series of online conversations on single topics in tobacco and nicotine, from the Nicotine Resource Consortium.',
    about: [],
    brandColor: '#8a2b6b',
    homepagePath: '/events/channels/infocus',
    contactEmail: 'infocus@nicotine360.org',
    format: 'online',
  },
}

export const CHANNEL_OPTIONS = Object.values(CHANNELS).map((c) => ({ label: c.name, value: c.key }))

export function isChannelKey(value: string): value is ChannelKey {
  return Object.prototype.hasOwnProperty.call(CHANNELS, value)
}
