export type ChannelKey = 'atnf' | 'gtnf' | 'infocus'

export type ChannelFormat = 'in-person' | 'online' | 'hybrid'

export type Channel = {
  key: ChannelKey
  name: string
  brandColor: string
  homepagePath: string
  contactEmail: string
  format: ChannelFormat
}

/**
 * Events belong to a channel, which sets their brand color, homepage and
 * contact email. These change so rarely they live in code rather than a
 * collection; the event stores only the channel key.
 */
export const CHANNELS: Record<ChannelKey, Channel> = {
  atnf: {
    key: 'atnf',
    name: 'ATNF',
    brandColor: '#1f6f5c',
    homepagePath: '/events/channels/atnf',
    contactEmail: 'atnf@nicotine360.org',
    format: 'hybrid',
  },
  gtnf: {
    key: 'gtnf',
    name: 'GTNF',
    brandColor: '#1a5485',
    homepagePath: '/events/channels/gtnf',
    contactEmail: 'gtnf@nicotine360.org',
    format: 'hybrid',
  },
  infocus: {
    key: 'infocus',
    name: 'InFocus',
    brandColor: '#8a2b6b',
    homepagePath: '/events/channels/infocus',
    contactEmail: 'infocus@nicotine360.org',
    format: 'online',
  },
}

export const CHANNEL_OPTIONS = Object.values(CHANNELS).map((c) => ({ label: c.name, value: c.key }))
