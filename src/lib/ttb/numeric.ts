/**
 * pg returns NUMERIC (including SUM(bigint)) as strings by default. Convert
 * trade measures at the query boundary, without changing Payload's global
 * type parsers. Null sums mean no observations and contribute zero.
 * Fractional quantities (e.g. pieces converted to dozens) remain fractional.
 */
export function tradeNumber(value: unknown, field: string): number {
  if (value === null) return 0
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value))) {
    throw new Error(`Invalid trade number for ${field}`)
  }
  const number = Number(value)
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Trade number for ${field} is outside the safe numeric range`)
  }
  return number
}
