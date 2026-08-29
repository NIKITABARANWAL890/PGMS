import { Badge } from '@/components/ui'
import type { PGSummary } from '@/types/api'

/**
 * The PG identity strip shown at the top of every workspace page.
 *
 * This is now the *only* place the PG's name appears in the workspace chrome
 * — the sub-sidebar no longer repeats it (see `WorkspaceSidebar`), so there is
 * one clear answer to "which property am I looking at", not two slightly
 * different-looking ones a scroll apart.
 *
 * A light brand-tinted wash rather than a full-strength gradient fill: the
 * saturated version read as loud sitting above five/six cards of ordinary
 * white content on every tab — a banner that has to compete for attention on
 * every page isn't doing its job of just supplying quiet context.
 */
export function PropertyBanner({ pg }: { pg: PGSummary }) {
  return (
    <div className="mb-5 rounded-2xl border border-brand-100 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{pg.name}</h1>
        <Badge tone="green">Active</Badge>
        {pg.pg_code ? <Badge tone="slate">{pg.pg_code}</Badge> : null}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {[pg.address, pg.city, pg.state, pg.pincode].filter(Boolean).join(', ')}
      </p>
    </div>
  )
}
