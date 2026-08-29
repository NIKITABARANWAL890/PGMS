import { Outlet, useLocation, useParams } from 'react-router-dom'

import { Breadcrumbs, EmptyState, Spinner } from '@/components/ui'

import { useGetPGQuery } from '../propertiesApi'
import { PropertyBanner } from './PropertyBanner'
import { workspaceTabLabel } from './WorkspaceSidebar'

/**
 * The property workspace header — PG identity plus a breadcrumb back out.
 *
 * Navigation itself lives in `WorkspaceSidebar`, one level up in `OwnerLayout`,
 * since it needs to sit beside the global sidebar as a sibling column rather
 * than as content inside this page. This component only shows *where you are*
 * (breadcrumb, PG name, which tab), not *where you can go*.
 */
export default function PGWorkspaceLayout() {
  const { pgId = '' } = useParams()
  const location = useLocation()
  const { data: pg, isLoading, isError } = useGetPGQuery(pgId, { skip: !pgId })

  if (isLoading) return <Spinner label="Loading property" />
  if (isError || !pg) {
    return (
      <EmptyState
        title="Could not load this property"
        hint="It may have been removed, or you may not have access to it."
      />
    )
  }

  const afterPgId = location.pathname.split(`/properties/${pgId}`)[1] ?? ''
  const tabLabel = workspaceTabLabel(afterPgId.replace(/^\//, ''))

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Properties', to: '/properties' },
          { label: pg.name, to: `/properties/${pg.id}` },
          { label: tabLabel },
        ]}
      />

      <PropertyBanner pg={pg} />

      <Outlet context={{ pg }} />
    </>
  )
}
