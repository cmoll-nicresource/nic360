type Option = { id: number | string; name: string }

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
  filters: { sector?: string; product?: string; subject?: string; location?: string }
}) {
  return (
    <form method="get" action={basePath} className="card filter-bar">
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
      {(filters.sector || filters.product || filters.subject || filters.location) && (
        <a href={basePath} className="clear-filters">
          Clear
        </a>
      )}
    </form>
  )
}
