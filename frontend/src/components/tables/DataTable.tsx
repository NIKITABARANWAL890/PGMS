import type { ReactNode } from 'react'

export interface Column<T> {
  header: string
  /** Rendered cell. Kept as a function so a column can combine several fields. */
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
}

/**
 * The plain table used by Properties, Rooms & Beds and Staff Overview.
 *
 * Sorting, pagination and filtering are deliberately absent: no Phase 1 screen
 * has enough rows to need them, and adding them now would be guessing at
 * behaviour before there is data to shape it.
 */
export function DataTable<T>({ columns, rows, rowKey, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={`px-4 py-3 text-${column.align ?? 'left'} text-xs font-semibold tracking-wide text-slate-500 uppercase`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-slate-500"
              >
                {emptyMessage ?? 'Nothing here yet.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((column) => (
                  <td
                    key={column.header}
                    className={`px-4 py-3 text-${column.align ?? 'left'} text-slate-700`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
