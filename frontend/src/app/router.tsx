import { Navigate, Route, Routes } from 'react-router-dom'

import { Spinner } from '@/components/ui'
import { useCurrentUserQuery } from '@/features/auth/authApi'
import LoginPage from '@/features/auth/LoginPage'
import ProfilePage from '@/features/auth/ProfilePage'
import RegisterPage from '@/features/auth/RegisterPage'
import OwnerDashboardPage from '@/features/dashboard/OwnerDashboardPage'
import OwnerLayout from '@/features/dashboard/OwnerLayout'
import StaffLayout, { StaffDashboardPage } from '@/features/dashboard/StaffLayout'
import PropertiesPage from '@/features/properties/PropertiesPage'
import PGSetupPage from '@/features/properties/setup/PGSetupPage'
import PGBedsTab from '@/features/properties/workspace/PGBedsTab'
import PGBuildingsTab from '@/features/properties/workspace/PGBuildingsTab'
import FloorDetailPage from '@/features/properties/workspace/FloorDetailPage'
import PGDashboardTab from '@/features/properties/workspace/PGDashboardTab'
import PGDetailsTab from '@/features/properties/workspace/PGDetailsTab'
import PGRoomsTab from '@/features/properties/workspace/PGRoomsTab'
import PGStaffTab from '@/features/properties/workspace/PGStaffTab'
import PGWorkspaceLayout from '@/features/properties/workspace/PGWorkspaceLayout'
import RoomsAndBedsPage from '@/features/properties/RoomsAndBedsPage'
import StaffPage from '@/features/staff/StaffPage'
import { useAppSelector } from '@/hooks/redux'

/**
 * Routing branches on role, not on which page the user asks for.
 *
 * Owners and staff get different shells with different navs, so there is no
 * single route table with items conditionally hidden — the role picks the
 * table. This is presentation only: the API enforces the same boundary on its
 * own, so a staff member who types an owner URL still gets refused server-side.
 */
export function AppRouter() {
  const { accessToken, user, bootstrapping } = useAppSelector((state) => state.auth)

  // Re-establish the session on a page reload before deciding where to send
  // anyone, otherwise a refresh would bounce a signed-in user to /login.
  const { isLoading } = useCurrentUserQuery(undefined, { skip: !accessToken && !bootstrapping })

  if (bootstrapping || (accessToken && isLoading && !user)) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Restoring your session" />
      </div>
    )
  }

  if (!accessToken || !user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (user.role === 'staff') {
    return (
      <Routes>
        <Route element={<StaffLayout />}>
          <Route index element={<StaffDashboardPage />} />
          <Route path="/rooms-and-beds" element={<RoomsAndBedsPage canManage={false} />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<OwnerLayout />}>
        <Route index element={<OwnerDashboardPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/new" element={<PGSetupPage />} />
        {/* The per-property workspace: one layout, the guide's sub-nav, and a
            tab per section. Tabs read their PG from the layout's context. */}
        <Route path="/properties/:pgId" element={<PGWorkspaceLayout />}>
          <Route index element={<PGDashboardTab />} />
          <Route path="details" element={<PGDetailsTab />} />
          <Route path="buildings" element={<PGBuildingsTab />} />
          <Route path="rooms" element={<PGRoomsTab />} />
          <Route path="beds" element={<PGBedsTab />} />
          <Route path="staff" element={<PGStaffTab />} />
        </Route>
        {/* One floor, with its rooms and beds inline. A sibling of the
            workspace route rather than nested under it: PGWorkspaceLayout
            renders its own PG title + breadcrumb, and this page needs its own
            deeper one ("... / Rooms / Floor 2") -- nesting the two would stack
            both headers on screen at once. OwnerLayout's WorkspaceSidebar still
            shows here, since it matches on the URL directly, not on which
            route element handled it. */}
        <Route path="/properties/:pgId/floors/:floorId" element={<FloorDetailPage />} />
        <Route path="/rooms-and-beds" element={<RoomsAndBedsPage canManage />} />
        <Route path="/staff" element={<StaffPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
