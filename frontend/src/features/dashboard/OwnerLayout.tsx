import { Outlet, useMatch } from 'react-router-dom'

import { AppShell, type NavItem } from '@/components/ui/AppShell'
import {
  IconBell,
  IconBuilding,
  IconChart,
  IconDashboard,
  IconMessage,
  IconReceipt,
  IconSettings,
  IconUsers,
} from '@/components/ui/icons'
import { useGetPGQuery } from '@/features/properties/propertiesApi'
import { WorkspaceSidebar } from '@/features/properties/workspace/WorkspaceSidebar'

// The global sidebar from the Owner UI guide, section 1 — the business-wide
// nav. Rooms and beds are deliberately absent: the guide moves them into the
// per-property workspace, because "which rooms?" only has an answer once a PG
// is selected. Phase 2-6 destinations are shown but marked, so the shell
// matches the intended product without pretending the screens exist yet.
const OWNER_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: <IconDashboard /> },
  { label: 'Properties', to: '/properties', icon: <IconBuilding /> },
  { label: 'Staff', to: '/staff', icon: <IconUsers /> },
  { label: 'Tenants', to: '/tenants', icon: <IconUsers />, comingSoon: true },
  { label: 'Bills & Payments', to: '/billing', icon: <IconReceipt />, comingSoon: true },
  { label: 'Complaints', to: '/complaints', icon: <IconMessage />, comingSoon: true },
  { label: 'Reports', to: '/reports', icon: <IconChart />, comingSoon: true },
  { label: 'Notices', to: '/notices', icon: <IconBell />, comingSoon: true },
  { label: 'Settings', to: '/settings', icon: <IconSettings />, comingSoon: true },
]

/**
 * Picking which property to look at is entirely the Properties page's job
 * now (its own "Viewing" filter, plus opening a card) — there is no longer a
 * PG switcher living in this chrome. Opening a PG replaces the whole-app nav
 * with that property's own workspace nav rather than layering the two; see
 * the note on `AppShell` for why.
 */
export default function OwnerLayout() {
  const workspaceMatch = useMatch('/properties/:pgId/*')
  const pgId = workspaceMatch?.params.pgId
  // "/properties/new" matches the same pattern (pgId="new") -- that is the
  // setup wizard, not a workspace, so it must not grow a PG sidebar.
  const inWorkspace = Boolean(pgId) && pgId !== 'new'
  const { data: pg } = useGetPGQuery(pgId ?? '', { skip: !inWorkspace })

  return (
    <AppShell
      brand="PG Manager"
      navItems={OWNER_NAV}
      secondaryNav={inWorkspace && pg ? <WorkspaceSidebar pgId={pg.id} /> : undefined}
    >
      <Outlet />
    </AppShell>
  )
}
