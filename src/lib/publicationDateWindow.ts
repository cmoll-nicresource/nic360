/** Inclusive issue calendar date, interpreted in the publication's Eastern timezone. */
export function publicationDateWindow(issueDate: string, days: number) {
  const parsed = new Date(issueDate)
  if (!Number.isFinite(parsed.getTime()) || !Number.isInteger(days) || days < 1)
    throw new Error('A valid issue date and positive whole-day window are required.')
  // Payload's day-only inputs store UTC midnight. Preserve the selected date.
  const day = parsed.toISOString().slice(0, 10)
  if (issueDate.slice(0, 10) !== day)
    throw new Error('The issue date must contain a valid calendar date.')
  const move = (amount: number) =>
    new Date(Date.parse(day + 'T00:00:00Z') + amount * 86400000).toISOString().slice(0, 10)
  const midnight = (date: string) => {
    const utc = Date.parse(date + 'T00:00:00Z')
    let instant = utc
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'shortOffset',
    })
    for (let i = 0; i < 3; i++) {
      const zone = format.formatToParts(instant).find((p) => p.type === 'timeZoneName')!.value
      const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(zone)
      if (!match) throw new Error('Unable to resolve publication timezone.')
      const offset =
        (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60000 * (match[1] === '+' ? 1 : -1)
      instant = utc - offset
    }
    return new Date(instant).toISOString()
  }
  return { since: midnight(move(1 - days)), until: midnight(move(1)) }
}
