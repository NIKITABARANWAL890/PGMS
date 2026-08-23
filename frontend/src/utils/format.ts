/** Rupee formatting, matching the wireframes' "₹ 8,000" style. */
export function formatRupees(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const amount = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(amount)) return '—'
  return `₹ ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function occupancyPercent(occupied: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((occupied / total) * 100)}%`
}

/** Pull a readable message out of an RTK Query error. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (typeof data === 'object' && data !== null && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail
      if (typeof detail === 'string') return detail
      // FastAPI validation errors arrive as a list of {loc, msg}.
      if (Array.isArray(detail) && detail.length > 0) {
        const first = detail[0] as { msg?: string }
        if (first?.msg) return first.msg
      }
    }
  }
  return fallback
}
