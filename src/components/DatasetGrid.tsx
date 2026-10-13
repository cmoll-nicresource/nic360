'use client'

import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from 'ag-grid-community'
import React, { useEffect, useMemo, useState } from 'react'

ModuleRegistry.registerModules([AllCommunityModule])

// Matches the brand palette in src/app/(frontend)/styles.css (--nrc-* vars)
// instead of AG Grid Community's default look.
const brandGridTheme = themeQuartz.withParams({
  accentColor: 'var(--nrc-primary)',
  borderColor: 'var(--nrc-border)',
  fontFamily: 'var(--font-sans), system-ui, sans-serif',
  headerBackgroundColor: 'var(--nrc-primary-dark)',
  headerTextColor: '#ffffff',
  headerFontWeight: 600,
  oddRowBackgroundColor: 'var(--nrc-bg)',
  rowHoverColor: '#e3eef8',
  wrapperBorder: '1px solid var(--nrc-border)',
  wrapperBorderRadius: 10,
})

type Column = {
  key?: string | null
  label: string
  type: 'text' | 'number' | 'percent' | 'year' | 'date' | 'country' | 'link'
  filterable?: boolean | null
  sortable?: boolean | null
}

export function DatasetGrid({ datasetId }: { datasetId: string }) {
  const [columns, setColumns] = useState<Column[] | null>(null)
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/datasets/${datasetId}/rows`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load rows.')
        setColumns(data.columns)
        setRows(data.rows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load rows.'))
  }, [datasetId])

  const columnDefs: ColDef[] = useMemo(() => {
    if (!columns) return []
    return columns.map((c) => ({
      field: c.key ?? '',
      headerName: c.label,
      filter: c.filterable !== false,
      sortable: c.sortable !== false,
      valueFormatter:
        c.type === 'percent'
          ? (p) => (p.value === null || p.value === undefined ? '' : `${p.value}%`)
          : undefined,
    }))
  }, [columns])

  if (error) return <p style={{ color: '#8a2b2b' }}>{error}</p>
  if (!columns || !rows) return <p className="muted">Loading…</p>

  return (
    <div style={{ height: 520 }}>
      <AgGridReact
        theme={brandGridTheme}
        columnDefs={columnDefs}
        rowData={rows}
        pagination
        paginationPageSize={50}
      />
    </div>
  )
}
