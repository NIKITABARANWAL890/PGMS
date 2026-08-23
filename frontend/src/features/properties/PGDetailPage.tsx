import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  MetricCard,
  Spinner,
} from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'
import { useAppDispatch } from '@/hooks/redux'
import { formatRupees, occupancyPercent } from '@/utils/format'

import { StructureBuilder } from './StructureBuilder'
import {
  useGetPGQuery,
  useListBuildingsQuery,
  useListPgFloorsQuery,
  usePgRoomsQuery,
} from './propertiesApi'
import { pgSelected } from './selectedPgSlice'

/**
 * Everything about one PG in one place.
 *
 * This is the answer to "where do I add beds?": a PG is created with just a
 * name and address, and its rooms and beds are built here, because a bed
 * cannot exist until the building and floor above it do. Putting the builder
 * on the PG's own page keeps that dependency visible instead of stranding the
 * owner on a Properties table with nowhere obvious to go next.
 */
export default function PGDetailPage() {
  const { pgId = '' } = useParams()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const { data: pg, isLoading, isError } = useGetPGQuery(pgId, { skip: !pgId })
  const { data: rooms } = usePgRoomsQuery(pgId, { skip: !pgId })
  const { data: buildings = [] } = useListBuildingsQuery(pgId, { skip: !pgId })
  const { data: floors = [] } = useListPgFloorsQuery(pgId, { skip: !pgId })

  if (isLoading) return <Spinner label="Loading property" />
  if (isError || !pg) {
    return (
      <EmptyState
        title="Could not load this property"
        hint="It may have been removed, or you may not have access to it."
      />
    )
  }

  const roomCount = rooms?.rooms.length ?? 0

  return (
    <>
      <PageHeader
        title={pg.name}
        description={pg.address}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/properties')}>
              ← All properties
            </Button>
            <Button
              onClick={() => {
                // Point the header switcher at this PG so the operational
                // screen opens on the property you were just looking at.
                dispatch(pgSelected(pg.id))
                navigate('/rooms-and-beds')
              }}
            >
              Open Rooms &amp; Beds
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total beds" value={pg.total_beds} />
        <MetricCard
          label="Occupied"
          value={pg.occupied_beds}
          tone="positive"
          note={`${occupancyPercent(pg.occupied_beds, pg.total_beds)} occupancy`}
        />
        <MetricCard label="Vacant" value={pg.vacant_beds} tone="warning" />
        <MetricCard label="Maintenance" value={pg.maintenance_beds} tone="muted" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Buildings</CardTitle>
          {buildings.length === 0 ? (
            <p className="text-sm text-slate-500">
              None yet — add one below to start.
            </p>
          ) : (
            <ul className="space-y-2">
              {buildings.map((building) => (
                <li
                  key={building.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-800">{building.name}</span>
                  <span className="text-xs text-slate-500">
                    {floors.filter((f) => f.building_id === building.id).length} floor(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Floors</CardTitle>
          {floors.length === 0 ? (
            <p className="text-sm text-slate-500">
              None yet — floors need a building first.
            </p>
          ) : (
            <ul className="space-y-2">
              {floors.map((floor) => (
                <li
                  key={floor.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium text-slate-800">{floor.floor_label}</span>
                    <span className="block text-xs text-slate-500">
                      {floor.building_name}
                    </span>
                  </span>
                  <Badge tone={floor.room_count > 0 ? 'blue' : 'slate'}>
                    {floor.room_count} room(s)
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Rooms &amp; beds</CardTitle>
          {roomCount === 0 ? (
            <p className="text-sm text-slate-500">
              No rooms yet. Add a building, then a floor, then rooms — beds are
              added per room.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {roomCount} room(s), {pg.total_beds} bed(s) in total.
              </p>
              <ul className="mt-3 space-y-2">
                {rooms?.rooms.slice(0, 5).map((room) => (
                  <li
                    key={room.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium text-slate-800">
                        Room {room.room_number}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {room.floor_label} · {room.room_type}
                      </span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {room.beds.length}/{room.total_beds} beds
                    </span>
                  </li>
                ))}
              </ul>
              {roomCount > 5 ? (
                <Link
                  to="/rooms-and-beds"
                  onClick={() => dispatch(pgSelected(pg.id))}
                  className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
                >
                  View all {roomCount} rooms →
                </Link>
              ) : null}
            </>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <StructureBuilder pgId={pg.id} />
      </div>

      {pg.total_beds > 0 ? (
        <Card className="mt-6">
          <CardTitle>Bed rates</CardTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rooms?.rooms.flatMap((room) =>
              room.beds.map((bed) => (
                <div
                  key={bed.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">
                    Room {room.room_number} · {bed.bed_label}
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatRupees(bed.monthly_rent)}
                  </span>
                </div>
              )),
            )}
          </div>
        </Card>
      ) : null}
    </>
  )
}
