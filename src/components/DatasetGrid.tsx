'use client'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from 'ag-grid-community'
import { useEffect, useMemo, useState } from 'react'
import {
  comparisonBars,
  filterDataRows,
  metricColumns,
  type DataRecord,
  type ExploreColumn,
} from '@/lib/datasetExplore'
import { DataBars } from '@/components/frontend/DataBars'
ModuleRegistry.registerModules([AllCommunityModule])
const brandGridTheme = themeQuartz.withParams({
  accentColor: 'var(--nrc-primary)',
  borderColor: 'var(--nrc-border)',
  fontFamily: 'var(--font-sans), system-ui, sans-serif',
  headerBackgroundColor: '#f1f4f8',
  headerTextColor: '#0f1722',
  headerFontWeight: 600,
  rowHoverColor: 'var(--nrc-bg)',
  wrapperBorderRadius: 8,
})
type Column = ExploreColumn & { filterable?: boolean | null; sortable?: boolean | null }
type Loaded = { columns: Column[]; rows: DataRecord[] }
const EMPTY_COLUMNS: Column[] = []
const EMPTY_ROWS: DataRecord[] = []
export function DatasetGrid({ datasetId }: { datasetId: string }) {
  const [data, setData] = useState<Loaded | null>(null)
  const [loadedCount, setLoadedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'chart'>('chart')
  const [country, setCountry] = useState('')
  const [year, setYear] = useState('')
  const [query, setQuery] = useState('')
  const [metric, setMetric] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setData(null)
      setError(null)
      setLoadedCount(0)
      const all: DataRecord[] = []
      let columns: Column[] = []
      let page = 1
      let totalPages = 1
      do {
        const res = await fetch(`/api/datasets/${datasetId}/rows?page=${page}`, {
          signal: controller.signal,
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error || 'Unable to load this dataset.')
        columns = result.columns
        all.push(...result.rows)
        setLoadedCount(all.length)
        totalPages = result.totalPages || 1
        page++
      } while (page <= totalPages)
      const yearKey = columns.find((c) => c.type === 'year')?.key
      const years = yearKey
        ? [...new Set(all.map((row) => String(row[yearKey] ?? '')).filter(Boolean))].sort((a, b) =>
            b.localeCompare(a, undefined, { numeric: true }),
          )
        : []
      setYear(years[0] || '')
      setCountry('')
      setQuery('')
      setMetric(metricColumns(columns)[0]?.key || '')
      setData({ columns, rows: all })
    }
    load().catch((err) => {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Unable to load data.')
    })
    return () => controller.abort()
  }, [datasetId])
  const columns = data?.columns || EMPTY_COLUMNS
  const rows = data?.rows || EMPTY_ROWS
  const countries = useMemo(() => {
    const key = columns.find((c) => c.type === 'country')?.key
    return key ? [...new Set(rows.map((row) => String(row[key] ?? '')).filter(Boolean))].sort() : []
  }, [columns, rows])
  const years = useMemo(() => {
    const key = columns.find((c) => c.type === 'year')?.key
    return key
      ? [...new Set(rows.map((row) => String(row[key] ?? '')).filter(Boolean))].sort((a, b) =>
          b.localeCompare(a, undefined, { numeric: true }),
        )
      : []
  }, [columns, rows])
  const filtered = useMemo(
    () => filterDataRows(rows, columns, country, year, query),
    [rows, columns, country, year, query],
  )
  const metrics = metricColumns(columns)
  const selectedMetric = metrics.find((c) => c.key === metric)
  const bars = useMemo(() => comparisonBars(filtered, columns, metric), [filtered, columns, metric])
  const columnDefs: ColDef[] = useMemo(
    () =>
      columns.map((c) => ({
        field: c.key || '',
        headerName: c.label,
        filter: c.filterable !== false,
        sortable: c.sortable !== false,
        flex: 1,
        minWidth: ['text', 'country'].includes(c.type) ? 200 : 130,
        type: ['number', 'percent', 'year'].includes(c.type) ? 'rightAligned' : undefined,
        cellClass: ['number', 'percent', 'year'].includes(c.type) ? 'num' : undefined,
        valueFormatter:
          c.type === 'percent'
            ? (p) => (p.value == null ? '' : `${p.value}%`)
            : c.type === 'number'
              ? (p) => (typeof p.value === 'number' ? p.value.toLocaleString() : (p.value ?? ''))
              : undefined,
      })),
    [columns],
  )
  if (error)
    return (
      <div role="alert" className="edition-empty">
        {error}{' '}
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    )
  if (!data)
    return (
      <div className="edition-empty" role="status">
        Loading dataset{loadedCount ? ` · ${loadedCount.toLocaleString()} records` : '…'}
      </div>
    )
  return (
    <div className="edition-explorer">
      <div className="edition-explorer-toolbar">
        <div className="edition-view-switch" aria-label="Data view">
          <button
            type="button"
            aria-pressed={view === 'chart'}
            onClick={() => setView('chart')}
            disabled={!metrics.length}
          >
            Chart
          </button>
          <button
            type="button"
            aria-pressed={view === 'table' || !metrics.length}
            onClick={() => setView('table')}
          >
            Table
          </button>
        </div>
        <span className="edition-meta">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()} records
        </span>
        <div className="edition-actions">
          <a href={`/api/datasets/${datasetId}/export?format=csv`} className="btn btn-secondary">
            CSV ↓
          </a>
          <a href={`/api/datasets/${datasetId}/export?format=xlsx`} className="btn btn-secondary">
            Excel ↓
          </a>
        </div>
      </div>
      <div className="edition-explorer-filters">
        {!!countries.length && (
          <label>
            Country
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">All countries</option>
              {countries.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        {!!years.length && (
          <label>
            Year
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All years</option>
              {years.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <label className="edition-filter-search">
          Search records
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company, commodity, country…"
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setCountry('')
            setYear('')
            setQuery('')
          }}
        >
          Reset filters
        </button>
      </div>
      {view === 'chart' && metrics.length ? (
        <div className="edition-chart-panel">
          <div className="edition-section-heading">
            <div>
              <p className="edition-eyebrow">RECORD COMPARISON</p>
              <h2>{selectedMetric?.label}</h2>
            </div>
            <label>
              Measure
              <select value={metric} onChange={(e) => setMetric(e.target.value)}>
                {metrics.map((c) => (
                  <option key={c.key} value={c.key!}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="edition-chart-note">
            Up to 12 records with the highest values in the current selection. Each bar is one
            record; values are not added together.
          </p>
          <DataBars bars={bars} percent={selectedMetric?.type === 'percent'} />
        </div>
      ) : (
        <div className="edition-grid-container">
          <AgGridReact
            theme={brandGridTheme}
            columnDefs={columnDefs}
            rowData={filtered}
            pagination
            paginationPageSize={50}
          />
        </div>
      )}
      <p className="edition-meta edition-download-note">
        Downloads include the complete dataset. Use the table’s column filters for additional
        detail.
      </p>
    </div>
  )
}
