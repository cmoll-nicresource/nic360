'use client'

import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from 'ag-grid-community'
import React, { useEffect, useMemo, useState } from 'react'

ModuleRegistry.registerModules([AllCommunityModule])

// Matches the brand palette in src/app/(frontend)/styles.css (--nrc-* vars)
// instead of AG Grid Community's default look. A light header (not a heavy
// navy bar) so the data carries the color, not the chrome.
const brandGridTheme = themeQuartz.withParams({
  accentColor: 'var(--nrc-primary)',
  borderColor: 'var(--nrc-border)',
  fontFamily: 'var(--font-sans), system-ui, sans-serif',
  headerBackgroundColor: '#f1f4f8',
  headerTextColor: '#0f1722',
  headerFontWeight: 600,
  oddRowBackgroundColor: '#fff',
  rowHoverColor: 'var(--nrc-bg)',
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
    const isNumeric = (type: Column['type']) => type === 'number' || type === 'percent' || type === 'year'
    return columns.map((c) => ({
      field: c.key ?? '',
      headerName: c.label,
      filter: c.filterable !== false,
      sortable: c.sortable !== false,
      flex: 1,
      minWidth: 120,
      type: isNumeric(c.type) ? 'rightAligned' : undefined,
      cellClass: isNumeric(c.type) ? 'num' : undefined,
      valueFormatter:
        c.type === 'percent'
          ? (p) => (p.value === null || p.value === undefined ? '' : `${p.value}%`)
          : undefined,
    }))
  }, [columns])

  if (error) return <p style={{ color: '#8a2b2b' }}>{error}</p>
  if (!columns || !rows) return <p className="muted">Loading…</p>

  return (
    <div style={{ height: 'calc(100vh - 280px)', minHeight: 480 }}>
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
