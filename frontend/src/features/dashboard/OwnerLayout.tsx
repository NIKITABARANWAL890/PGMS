import { Outlet } from 'react-router-dom'

import { AppShell, type NavItem } from '@/components/ui/AppShell'
import { Select } from '@/components/ui'
import { useListPGsQuery } from '@/features/properties/propertiesApi'
import { pgSelected } from '@/features/properties/selectedPgSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'

// The full owner nav from the wireframe. Phase 2-6 destinations are shown but
// marked, so the shell matches the intended product without pretending the
// screens behind them exist yet.
const OWNER_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'Properties', to: '/properties' },
  { label: 'Rooms & Beds', to: '/rooms-and-beds' },
  { label: 'Staff', to: '/staff' },
  { label: 'Tenants', to: '/tenants', comingSoon: true },
  { label: 'Bills & Payments', to: '/billing', comingSoon: true },
  { label: 'Complaints', to: '/complaints', comingSoon: true },
  { label: 'Move-outs', to: '/moveouts', comingSoon: true },
  { label: 'Reports', to: '/reports', comingSoon: true },
]

export default function OwnerLayout() {
  return (
    <AppShell brand="PG Manager" navItems={OWNER_NAV} switcher={<OwnerPGSwitcher />}>
      <Outlet />
    </AppShell>
  )
}

function OwnerPGSwitcher() {
  const { data: pgs = [] } = useListPGsQuery()
  const selectedPgId = useAppSelector((state) => state.selectedPg.selectedPgId)
  const dispatch = useAppDispatch()

  if (pgs.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        Viewing
      </span>
      <Select
        className="w-56"
        value={selectedPgId ?? 'all'}
        onChange={(event) => {
          const value = event.target.value
          dispatch(pgSelected(value === 'all' ? null : value))
        }}
      >
        {/* "All PGs" is the owner's cross-property view (plan Module 1). */}
        <option value="all">All PGs</option>
        {pgs.map((pg) => (
          <option key={pg.id} value={pg.id}>
            {pg.name}
          </option>
        ))}
      </Select>
    </div>
  )
}
