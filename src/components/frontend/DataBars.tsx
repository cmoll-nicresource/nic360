import type { comparisonBars } from '@/lib/datasetExplore'

export function DataBars({
  bars,
  percent = false,
  compact = false,
}: {
  bars: ReturnType<typeof comparisonBars>
  percent?: boolean
  compact?: boolean
}) {
  const min = Math.min(0, ...bars.map((b) => b.value))
  const max = Math.max(0, ...bars.map((b) => b.value))
  const range = max - min || 1
  const zero = (-min / range) * 100
  if (!bars.length) return <p className="muted">No numeric records match these filters.</p>
  return (
    <div
      className={`edition-bars${compact ? ' edition-bars--compact' : ''}`}
      role="list"
      aria-label="Record comparison"
    >
      {bars.map((bar, i) => (
        <div className="edition-bar" key={`${bar.index}-${i}`} role="listitem">
          <div className="edition-bar-label">
            <span title={bar.label}>{bar.label}</span>
            <strong>
              {bar.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              {percent ? '%' : ''}
            </strong>
          </div>
          <div className="edition-bar-track">
            <span
              style={{
                left: `${bar.value < 0 ? ((bar.value - min) / range) * 100 : zero}%`,
                width: `${(Math.abs(bar.value) / range) * 100}%`,
              }}
            />
            <i style={{ left: `${zero}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
