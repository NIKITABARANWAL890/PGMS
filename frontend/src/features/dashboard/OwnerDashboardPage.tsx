import { Link } from 'react-router-dom'

import { Card, CardTitle, EmptyState, MetricCard, Spinner } from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'
import { useListPGsQuery } from '@/features/properties/propertiesApi'
import { occupancyPercent } from '@/utils/format'

/**
 * The dashboard shell, showing the metrics Phase 1 can actually compute.
 *
 * Bed counts are real, straight from the bed-status query. Rent, complaints and
 * move-outs are not shown at all rather than shown as zeros: a "₹ 0 collected"
 * tile is indistinguishable from a real month with no payments, and the plan is
 * explicit that an honest placeholder beats a fake number. Phase 6 fills these
 * in once Phases 3-5 produce the data.
 *
 * Always the all-properties aggregate — there is no per-PG scoping here any
 * more. Wanting one property's own numbers is what opening its workspace
 * (Properties -> that PG -> Dashboard tab) is for; this page would only be
 * duplicating that view under a confusing second toggle.
 */
export default function OwnerDashboardPage() {
  const { data: pgs, isLoading } = useListPGsQuery()

  if (isLoading) return <Spinner label="Loading dashboard" />

  const allPGs = pgs ?? []

  const totals = allPGs.reduce(
    (acc, pg) => ({
      beds: acc.beds + pg.total_beds,
      occupied: acc.occupied + pg.occupied_beds,
      vacant: acc.vacant + pg.vacant_beds,
      maintenance: acc.maintenance + pg.maintenance_beds,
    }),
    { beds: 0, occupied: 0, vacant: 0, maintenance: 0 },
  )

  return (
    <>
      <PageHeader
        title="Dashboard overview"
        description="Every property on this account, combined."
      />

      {allPGs.length === 0 ? (
        <EmptyState
          title="No properties yet"
          hint="Add your first PG from the Properties screen to start tracking beds."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Total properties" value={allPGs.length} />
            <MetricCard label="Total beds" value={totals.beds} />
            <MetricCard
              label="Occupied beds"
              value={totals.occupied}
              tone="positive"
              note={`${occupancyPercent(totals.occupied, totals.beds)} occupancy`}
            />
            <MetricCard label="Vacant beds" value={totals.vacant} tone="warning" />
            <MetricCard label="Under maintenance" value={totals.maintenance} tone="muted" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Occupancy by property</CardTitle>
              <ul className="space-y-3">
                {allPGs.map((pg) => (
                  <li key={pg.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{pg.name}</span>
                      <span className="text-slate-500">
                        {pg.occupied_beds}/{pg.total_beds} beds ·{' '}
                        {occupancyPercent(pg.occupied_beds, pg.total_beds)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width:
                            pg.total_beds === 0
                              ? '0%'
                              : `${(pg.occupied_beds / pg.total_beds) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle>Not available yet</CardTitle>
              <p className="text-sm text-slate-600">
                Rent collection, complaints and move-out figures need data that
                Phases 3-5 create. They are left out rather than shown as zeros,
                since a placeholder zero reads exactly like a real one.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-500">
                <li>• Expected / collected / outstanding rent — Phase 3</li>
                <li>• Open and overdue complaints — Phase 4</li>
                <li>• Upcoming move-outs — Phase 5</li>
                <li>• Attention Required panel — Phase 6</li>
              </ul>
              <Link
                to="/properties"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                Manage properties →
              </Link>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
