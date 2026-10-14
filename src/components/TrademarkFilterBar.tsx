type Filters = { keyword?: string; dateFrom?: string; dateTo?: string }

export function TrademarkFilterBar({ basePath, filters }: { basePath: string; filters: Filters }) {
  const hasAnyFilter = Object.values(filters).some(Boolean)

  return (
    <form method="get" action={basePath} className="card filter-bar">
      <label>
        Keyword
        <input type="search" name="keyword" defaultValue={filters.keyword ?? ''} placeholder="Brand, owner, goods…" />
      </label>
      <details className="filter-details">
        <summary>Filters</summary>
        <div className="filter-details-body">
          <label>
            From
            <input type="date" name="dateFrom" defaultValue={filters.dateFrom ?? ''} />
          </label>
          <label>
            To
            <input type="date" name="dateTo" defaultValue={filters.dateTo ?? ''} />
          </label>
          <button type="submit">Apply filters</button>
          {hasAnyFilter && (
            <a href={basePath} className="clear-filters">
              Clear
            </a>
          )}
        </div>
      </details>
    </form>
  )
}
