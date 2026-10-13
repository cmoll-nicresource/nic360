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

  return (
    <form method="get" action={basePath} className="card filter-bar">
      <label>
        Keyword
        <input type="search" name="keyword" defaultValue={filters.keyword ?? ''} placeholder="Search…" />
      </label>
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
    </form>
  )
}
