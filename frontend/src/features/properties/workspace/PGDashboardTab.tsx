import { Link } from 'react-router-dom'

import { Badge, Card, CardTitle, MetricCard } from '@/components/ui'
import { formatRupees, occupancyPercent } from '@/utils/format'

import {
  useFloorOverviewQuery,
  usePgRoomsQuery,
  usePgStructureQuery,
} from '../propertiesApi'
import { usePGWorkspace } from './context'

/**
 * Guide 5 — "what is happening in this PG right now?"
 *
 * Occupancy and room status are real: they come from bed rows that exist. The
 * finance, complaints and move-out panels the guide also lists need invoices,
 * complaints and move-out requests, which arrive in Phases 3-5. Those panels
 * say so rather than showing zeros — a zero is a claim that nothing is
 * outstanding, which is a different and wrong statement.
 */
export default function PGDashboardTab() {
  const { pg } = usePGWorkspace()
  const { data: rooms } = usePgRoomsQuery(pg.id)
  const { data: buildings = [] } = usePgStructureQuery(pg.id)
  const { data: floors = [] } = useFloorOverviewQuery(pg.id)

  const roomCount = buildings.reduce((sum, b) => sum + b.room_count, 0)
  const expectedRent = (rooms?.rooms ?? [])
    .flatMap((room) => room.beds)
    .reduce((sum, bed) => sum + Number(bed.monthly_rent ?? 0), 0)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total beds" value={pg.total_beds} />
        <MetricCard
          label="Occupied beds"
          value={pg.occupied_beds}
          tone="positive"
          note={`${occupancyPercent(pg.occupied_beds, pg.total_beds)} occupancy`}
        />
        <MetricCard label="Available beds" value={pg.vacant_beds} tone="warning" />
        <MetricCard
          label="Monthly rent"
          value={formatRupees(expectedRent)}
          note="Sum of bed rents"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Structure</CardTitle>
          <dl className="space-y-2 text-sm">
            <Row label="Buildings" value={buildings.length} />
            <Row label="Floors" value={floors.length} />
            <Row label="Rooms" value={roomCount} />
            <Row label="Beds" value={pg.total_beds} />
          </dl>
          <Link
            to="buildings"
            className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
          >
            Manage structure →
          </Link>
        </Card>

        <Card>
          <CardTitle>Room status</CardTitle>
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatusTile label="Occupied" value={pg.occupied_beds} tone="text-emerald-600" />
            <StatusTile label="Available" value={pg.vacant_beds} tone="text-amber-600" />
            <StatusTile
              label="Maintenance"
              value={pg.maintenance_beds}
              tone="text-slate-500"
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Counted per bed, read from bed status.
          </p>
        </Card>

        <Card>
          <CardTitle>Floors</CardTitle>
          {floors.length === 0 ? (
            <p className="text-sm text-slate-500">No floors yet.</p>
          ) : (
            <ul className="space-y-2">
              {floors.slice(0, 5).map((floor) => (
                <li
                  key={floor.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-800">{floor.floor_label}</span>
                  {floor.room_count > 0 ? (
                    <Badge tone="green">{floor.room_count} rooms</Badge>
                  ) : (
                    <Badge tone="amber">Not configured</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ComingSoonPanel
          title="Rent overview"
          phase={3}
          detail="Collected, pending and outstanding rent need invoices and payments."
        />
        <ComingSoonPanel
          title="Complaints"
          phase={4}
          detail="Open and overdue complaint counts need the complaints table."
        />
        <ComingSoonPanel
          title="Upcoming move-outs"
          phase={5}
          detail="Notices and settlements need move-out requests."
        />
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 py-3">
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  )
}

/** An honest placeholder: names what is missing and when it arrives. */
function ComingSoonPanel({
  title,
  phase,
  detail,
}: {
  title: string
  phase: number
  detail: string
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-500">{title}</h2>
        <Badge tone="slate">Phase {phase}</Badge>
      </div>
      <p className="text-sm text-slate-500">{detail}</p>
    </div>
  )
}
