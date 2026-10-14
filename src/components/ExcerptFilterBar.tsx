type Option = { id: number | string; name: string }
type Filters = {
  sector?: string
  product?: string
  subject?: string
  location?: string
  keyword?: string
  dateFrom?: string
  dateTo?: string
}

export function ExcerptFilterBar({
  basePath,
  sectors,
  products,
  subjects,
  locations,
  filters,
}: {
  basePath: string
  sectors: Option[]
  products: Option[]
  subjects: Option[]
  locations: Option[]
  filters: Filters
}) {
  const hasAnyFilter = Object.values(filters).some(Boolean)

  const activeChips: { key: string; label: string }[] = []
  if (filters.keyword) activeChips.push({ key: 'keyword', label: `"${filters.keyword}"` })
  if (filters.sector) {
    const name = sectors.find((s) => String(s.id) === filters.sector)?.name
    if (name) activeChips.push({ key: 'sector', label: name })
  }
  if (filters.product) {
    const name = products.find((p) => String(p.id) === filters.product)?.name
    if (name) activeChips.push({ key: 'product', label: name })
  }
  if (filters.subject) {
    const name = subjects.find((s) => String(s.id) === filters.subject)?.name
    if (name) activeChips.push({ key: 'subject', label: name })
  }
  if (filters.location) {
    const name = locations.find((l) => String(l.id) === filters.location)?.name
    if (name) activeChips.push({ key: 'location', label: name })
  }

  function removeChipHref(key: string): string {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) {
      if (v && k !== key) params.set(k, v)
    }
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <div className="card">
      <form method="get" action={basePath} className="filter-bar">
      <label>
        Keyword
        <input type="search" name="keyword" defaultValue={filters.keyword ?? ''} placeholder="Search…" />
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
          <label>
            Sector
            <select name="sector" defaultValue={filters.sector ?? ''}>
              <option value="">All sectors</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Product
            <select name="product" defaultValue={filters.product ?? ''}>
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <select name="subject" defaultValue={filters.subject ?? ''}>
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location
            <select name="location" defaultValue={filters.location ?? ''}>
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
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
      {activeChips.length > 0 && (
        <div className="filter-summary">
          {activeChips.map((chip) => (
            <span key={chip.key} className="filter-pill">
              {chip.label}
              <a href={removeChipHref(chip.key)} aria-label={`Remove ${chip.label} filter`}>
                ×
              </a>
            </span>
          ))}
          <a href={basePath} className="clear-filters">
            Clear all
          </a>
        </div>
      )}
    </div>
  )
}
