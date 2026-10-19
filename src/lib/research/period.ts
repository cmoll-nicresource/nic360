export function researchMonth(month: string) {
  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
    Number(month.slice(0, 4)) < 1900
  )
    throw new Error('Select a valid research month.')
  const from = new Date(month + '-01T00:00:00Z')
  const until = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
  )
  return {
    from: from.toISOString(),
    until: until.toISOString(),
    label: new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(from),
  }
}
export function previousResearchMonth(asOf = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(asOf)
  const year = Number(parts.find((p) => p.type === 'year')!.value),
    month = Number(parts.find((p) => p.type === 'month')!.value)
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
}
