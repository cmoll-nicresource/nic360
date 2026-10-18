import { describe, expect, it } from 'vitest'

import { parseSesEvent } from './parseEvents'

function mail(
  overrides: Partial<{
    destination: string[]
    tags: Record<string, string[]>
    timestamp: string
  }> = {},
) {
  return {
    timestamp: '2026-10-11T12:00:00.000Z',
    messageId: 'msg-1',
    source: 'news@nicotine360.org',
    destination: ['user@example.com'],
    tags: { issueId: ['42'] },
    ...overrides,
  }
}

describe('parseSesEvent', () => {
  it('parses a Delivery event', () => {
    const event = parseSesEvent({
      eventType: 'Delivery',
      mail: mail(),
      delivery: { timestamp: '2026-10-11T12:00:01.000Z', recipients: ['user@example.com'] },
    })
    expect(event).toEqual({
      type: 'Delivery',
      messageId: 'msg-1',
      emails: ['user@example.com'],
      issueId: 42,
      occurredAt: '2026-10-11T12:00:01.000Z',
      bounceType: undefined,
    })
  })

  it('parses an Open event, using mail.destination (no dedicated recipient list on the open object)', () => {
    const event = parseSesEvent({
      eventType: 'Open',
      mail: mail(),
      open: {
        timestamp: '2026-10-11T12:05:00.000Z',
        userAgent: 'Mozilla/5.0',
        ipAddress: '1.2.3.4',
      },
    })
    expect(event?.type).toBe('Open')
    expect(event?.emails).toEqual(['user@example.com'])
    expect(event?.issueId).toBe(42)
  })

  it('parses a Click event the same way as Open', () => {
    const event = parseSesEvent({
      eventType: 'Click',
      mail: mail(),
      click: { timestamp: '2026-10-11T12:06:00.000Z', link: 'https://nicotine360.org/articles/1' },
    })
    expect(event?.type).toBe('Click')
    expect(event?.emails).toEqual(['user@example.com'])
  })

  it('parses a Bounce event, using bounce.bouncedRecipients (can differ from mail.destination)', () => {
    const event = parseSesEvent({
      eventType: 'Bounce',
      mail: mail({ destination: ['a@example.com', 'b@example.com'] }),
      bounce: {
        bounceType: 'Permanent',
        bounceSubType: 'General',
        timestamp: '2026-10-11T12:00:02.000Z',
        bouncedRecipients: [{ emailAddress: 'a@example.com', status: '5.1.1' }],
      },
    })
    expect(event).toEqual({
      type: 'Bounce',
      messageId: 'msg-1',
      emails: ['a@example.com'],
      issueId: 42,
      occurredAt: '2026-10-11T12:00:02.000Z',
      bounceType: 'Permanent',
    })
  })

  it('parses a Complaint event, using complaint.complainedRecipients', () => {
    const event = parseSesEvent({
      eventType: 'Complaint',
      mail: mail(),
      complaint: {
        timestamp: '2026-10-11T12:00:03.000Z',
        complainedRecipients: [{ emailAddress: 'user@example.com' }],
        complaintFeedbackType: 'abuse',
      },
    })
    expect(event?.type).toBe('Complaint')
    expect(event?.emails).toEqual(['user@example.com'])
  })

  it('returns null for an unrecognized eventType', () => {
    expect(parseSesEvent({ eventType: 'RenderingFailure', mail: mail() })).toBeNull()
  })

  it('returns null when there is no affected recipient', () => {
    expect(
      parseSesEvent({
        eventType: 'Bounce',
        mail: mail({ destination: [] }),
        bounce: { bouncedRecipients: [] },
      }),
    ).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(parseSesEvent(null)).toBeNull()
    expect(parseSesEvent('a string')).toBeNull()
    expect(parseSesEvent({})).toBeNull()
  })

  it('leaves issueId undefined when the message carries no issueId tag', () => {
    const event = parseSesEvent({
      eventType: 'Delivery',
      mail: mail({ tags: {} }),
      delivery: { recipients: ['user@example.com'] },
    })
    expect(event?.issueId).toBeUndefined()
  })
})
