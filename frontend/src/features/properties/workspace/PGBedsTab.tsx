import { useState } from 'react'

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  Field,
  MetricCard,
  Select,
  Spinner,
} from '@/components/ui'
import type { BedStatus } from '@/types/api'
import { apiErrorMessage, formatRupees } from '@/utils/format'

import {
  useFloorOverviewQuery,
  useGenerateBedsMutation,
  useListBuildingsQuery,
  usePgRoomsQuery,
  useUpdateBedStatusMutation,
} from '../propertiesApi'
import { usePGWorkspace } from './context'

const BED_TONE: Record<BedStatus, 'green' | 'amber' | 'slate'> = {
  occupied: 'green',
  vacant: 'amber',
  maintenance: 'slate',
}

/** Guide 9 — beds room-wise, the final occupancy unit. */
export default function PGBedsTab() {
  const { pg } = usePGWorkspace()
  const { data: floors = [] } = useFloorOverviewQuery(pg.id)
  const { data: buildings = [] } = useListBuildingsQuery(pg.id)
  const { data: allRooms, isLoading } = usePgRoomsQuery(pg.id)

  const [updateBedStatus, { error: statusError }] = useUpdateBedStatusMutation()
  const [generateBeds, { isLoading: generating, error: generateError }] =
    useGenerateBedsMutation()

  const [floorId, setFloorId] = useState('')
  const [roomId, setRoomId] = useState('')

  const error = statusError ?? generateError
  const buildingName = (id: string) => buildings.find((b) => b.id === id)?.name ?? ''

  const activeFloorId = floorId || floors[0]?.id || ''
  const roomsOnFloor = (allRooms?.rooms ?? []).filter((r) => r.floor_id === activeFloorId)
  const activeRoomId = roomId && roomsOnFloor.some((r) => r.id === roomId)
    ? roomId
    : roomsOnFloor[0]?.id || ''
  const room = roomsOnFloor.find((r) => r.id === activeRoomId)

  if (isLoading) return <Spinner label="Loading beds" />

  if (floors.length === 0) {
    return (
      <EmptyState
        title="No floors yet"
        hint="Set up the structure on the Buildings & Floors tab first."
      />
    )
  }

  const missing = room ? Math.max(0, room.total_beds - room.beds.length) : 0

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="w-56">
          <Field label="Select floor">
            <Select
              value={activeFloorId}
              onChange={(event) => {
                setFloorId(event.target.value)
                setRoomId('')
              }}
            >
              {floors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {buildingName(floor.building_id)} · {floor.floor_label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="w-56">
          <Field label="Select room">
            <Select
              value={activeRoomId}
              onChange={(event) => setRoomId(event.target.value)}
              disabled={roomsOnFloor.length === 0}
            >
              {roomsOnFloor.length === 0 ? (
                <option value="">No rooms on this floor</option>
              ) : (
                roomsOnFloor.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.room_number} ({r.room_type})
                  </option>
                ))
              )}
            </Select>
          </Field>
        </div>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not update the bed')}</ErrorNote>
        </div>
      ) : null}

      {!room ? (
        <EmptyState
          title="No rooms on this floor"
          hint="Add a room on the Rooms tab, and its beds come with it."
        />
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total beds" value={room.beds.length} />
            <MetricCard label="Occupied" value={room.occupied_beds} tone="positive" />
            <MetricCard label="Available" value={room.vacant_beds} tone="warning" />
            <MetricCard
              label="Rent per bed"
              value={formatRupees(room.monthly_rent)}
              tone="muted"
            />
          </div>

          {missing > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
              <p className="text-sm text-slate-700">
                Room {room.room_number} is declared with {room.total_beds} bed(s) but has{' '}
                {room.beds.length}.
              </p>
              <Button
                variant="secondary"
                disabled={generating}
                onClick={() =>
                  generateBeds({
                    roomId: room.id,
                    pgId: pg.id,
                    bed_count: room.total_beds,
                    monthly_rent: room.monthly_rent,
                  })
                }
              >
                {generating ? 'Creating…' : `Create the missing ${missing}`}
              </Button>
            </div>
          ) : null}

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                    <th className="py-2 pr-3">Bed label</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Tenant</th>
                    <th className="py-2 pr-3 text-right">Rent</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {room.beds.map((bed) => (
                    <tr key={bed.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {bed.bed_label}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge tone={BED_TONE[bed.status]}>{bed.status}</Badge>
                      </td>
                      {/* Guide 9 lists a tenant column. Tenants are Phase 2, so
                          this says so rather than showing a misleading blank. */}
                      <td className="py-2.5 pr-3 text-slate-400">Phase 2</td>
                      <td className="py-2.5 pr-3 text-right">
                        {formatRupees(bed.monthly_rent)}
                      </td>
                      <td className="py-2.5 text-right">
                        {bed.status === 'occupied' ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              updateBedStatus({
                                bedId: bed.id,
                                pgId: pg.id,
                                status:
                                  bed.status === 'maintenance' ? 'vacant' : 'maintenance',
                              })
                            }
                            className="text-sm font-medium text-brand-600 hover:underline"
                          >
                            {bed.status === 'maintenance'
                              ? 'Mark available'
                              : 'Mark maintenance'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {room.beds.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No beds in this room yet.
              </p>
            ) : null}
          </Card>
        </>
      )}
    </>
  )
}
