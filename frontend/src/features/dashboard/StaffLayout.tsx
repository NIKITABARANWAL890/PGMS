import { Outlet } from 'react-router-dom'

import { EmptyState, MetricCard, Spinner } from '@/components/ui'
import { AppShell, PageHeader, type NavItem } from '@/components/ui/AppShell'
import { useListMyAssignedPGsQuery } from '@/features/properties/propertiesApi'
import { useAppSelector } from '@/hooks/redux'

// A separate nav from the owner's, matching the Staff wireframe — staff get
// their own app shell rather than the owner's with items hidden.
const STAFF_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Rooms & Beds', to: '/rooms-and-beds' },
  { label: 'Complaints', to: '/complaints', comingSoon: true },
  { label: 'Maintenance Tasks', to: '/tasks', comingSoon: true },
  { label: 'Tenants', to: '/tenants', comingSoon: true },
  { label: 'Move-outs', to: '/moveouts', comingSoon: true },
  { label: 'Notices', to: '/notices', comingSoon: true },
]

export default function StaffLayout() {
  return (
    <AppShell brand="PG Staff" navItems={STAFF_NAV}>
      <Outlet />
    </AppShell>
  )
}

export function StaffDashboardPage() {
  const { data: pgs, isLoading } = useListMyAssignedPGsQuery()
  const user = useAppSelector((state) => state.auth.user)

  if (isLoading) return <Spinner label="Loading dashboard" />

  const assigned = pgs ?? []

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.full_name ?? 'there'}`}
        description="You can only see the properties the owner has assigned to you."
      />

      {assigned.length === 0 ? (
        <EmptyState
          title="No PGs assigned yet"
          hint="The owner needs to assign you to a property before you can see anything here."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Assigned properties" value={assigned.length} />
            <MetricCard label="Open complaints" value="—" tone="muted" note="Phase 4" />
            <MetricCard label="Today's tasks" value="—" tone="muted" note="Phase 4" />
          </div>

          <h2 className="mt-8 mb-3 text-base font-semibold text-slate-900">
            Your properties
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {assigned.map((pg) => (
              <li
                key={pg.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-medium text-slate-900">{pg.name}</p>
                <p className="text-sm text-slate-500">{pg.address}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
