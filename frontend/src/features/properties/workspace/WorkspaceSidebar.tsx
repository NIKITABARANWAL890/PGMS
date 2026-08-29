import { Link, useLocation } from 'react-router-dom'

import {
  IconActivity,
  IconBed,
  IconDashboard,
  IconDoor,
  IconFolder,
  IconInfo,
  IconLayers,
  IconUsers,
} from '@/components/ui/icons'

interface WorkspaceNavItem {
  label: string
  to: string
  icon: React.ReactNode
  /** Needs a table that arrives in a later phase. Shown, but not reachable. */
  phase?: number
  /**
   * Extra path segments (beyond `to` itself) that should still highlight this
   * tab. Only "Rooms" needs this: a floor's own detail page lives at
   * `floors/:floorId`, a sibling route rather than nested under `rooms`, but
   * it is still conceptually part of the Rooms tab.
   */
  alsoActiveFor?: string[]
}

const NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '', icon: <IconDashboard /> },
  { label: 'Details', to: 'details', icon: <IconInfo /> },
  { label: 'Buildings & Floors', to: 'buildings', icon: <IconLayers /> },
  { label: 'Rooms', to: 'rooms', icon: <IconDoor />, alsoActiveFor: ['floors'] },
  { label: 'Beds', to: 'beds', icon: <IconBed /> },
  { label: 'Tenants', to: 'tenants', icon: <IconUsers />, phase: 2 },
  { label: 'Staff', to: 'staff', icon: <IconUsers /> },
  { label: 'Documents', to: 'documents', icon: <IconFolder />, phase: 6 },
  { label: 'Activity', to: 'activity', icon: <IconActivity />, phase: 6 },
]

/**
 * The property sub-sidebar — the guide's second, PG-scoped navigation column.
 *
 * It sits immediately to the right of the global sidebar, spans the same full
 * height, and carries only links: no PG name, and no owner/staff role text.
 * The PG's identity lives in exactly one place in the workspace chrome — the
 * `PropertyBanner` on the page itself — rather than being repeated here too,
 * where a rename or a long name would just as easily go stale-looking or wrap
 * awkwardly in a column this narrow.
 */
export function WorkspaceSidebar({ pgId }: { pgId: string }) {
  const location = useLocation()
  const activeSegment =
    location.pathname.split(`/properties/${pgId}`)[1]?.replace(/^\//, '').split('/')[0] ?? ''

  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex">
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV.map((item) => {
          const isActive =
            activeSegment === item.to || item.alsoActiveFor?.includes(activeSegment)

          if (item.phase) {
            return (
              <span
                key={item.label}
                title={`Arrives in Phase ${item.phase}`}
                className="flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-300"
              >
                <span className="flex items-center gap-2.5 [&>svg]:h-4.5 [&>svg]:w-4.5">
                  {item.icon}
                  {item.label}
                </span>
                <span className="text-[10px] tracking-wide uppercase">soon</span>
              </span>
            )
          }

          return (
            <Link
              key={item.label}
              to={`/properties/${pgId}${item.to ? `/${item.to}` : ''}`}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-brand-50 font-medium text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              <span className="shrink-0 [&>svg]:h-4.5 [&>svg]:w-4.5">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

/** Label for whichever tab a workspace path resolves to — for headings/breadcrumbs. */
export function workspaceTabLabel(pathAfterPgId: string): string {
  const segment = pathAfterPgId.split('/').filter(Boolean)[0] ?? ''
  const match = NAV.find((item) => item.to === segment || item.alsoActiveFor?.includes(segment))
  return match?.label ?? 'Dashboard'
}
