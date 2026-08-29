import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  Badge,
  Breadcrumbs,
  Button,
  Card,
  ConfirmDelete,
  EmptyState,
  MetricCard,
  Spinner,
} from '@/components/ui'
import type { BedStatus, RoomWithBeds } from '@/types/api'
import { formatRupees, occupancyPercent } from '@/utils/format'

import { ConfigureFloorDrawer } from '../setup/ConfigureFloorDrawer'
import {
  useDeleteBedMutation,
  useDeleteRoomMutation,
  useFloorOverviewQuery,
  useGenerateBedsMutation,
  useGetPGQuery,
  useListBuildingsQuery,
  usePgRoomsQuery,
  useUpdateBedStatusMutation,
} from '../propertiesApi'
import { PropertyBanner } from './PropertyBanner'

const BED_TONE: Record<BedStatus, 'green' | 'amber' | 'slate'> = {
  occupied: 'green',
  vacant: 'amber',
  maintenance: 'slate',
}

/**
 * One floor, with every room on it and every bed in those rooms.
 *
 * The floors list answers "how far along is this floor"; this answers "what is
 * actually on it". Rooms are grouped with their beds inline rather than split
 * across two screens, because a room's beds are the only thing anyone opens a
 * room to see.
 */
export default function FloorDetailPage() {
  const { pgId = '', floorId = '' } = useParams()
  const navigate = useNavigate()

  const { data: pg } = useGetPGQuery(pgId, { skip: !pgId })
  const { data: floors = [], isLoading } = useFloorOverviewQuery(pgId, { skip: !pgId })
  const { data: buildings = [] } = useListBuildingsQuery(pgId, { skip: !pgId })
  const { data: allRooms } = usePgRoomsQuery(pgId, { skip: !pgId })

  const [addingRooms, setAddingRooms] = useState(false)
  const [pendingRoom, setPendingRoom] = useState<RoomWithBeds | null>(null)
  const [deleteRoom, { isLoading: deletingRoom, error: roomDeleteError }] =
    useDeleteRoomMutation()

  const floor = floors.find((f) => f.id === floorId)
  const rooms = (allRooms?.rooms ?? []).filter((r) => r.floor_id === floorId)
  const buildingName = buildings.find((b) => b.id === floor?.building_id)?.name ?? ''

  if (isLoading) return <Spinner label="Loading floor" />

  if (!floor) {
    return (
      <EmptyState
        title="Floor not found"
        hint="It may have been deleted."
        action={
          <Button variant="secondary" onClick={() => navigate(`/properties/${pgId}/rooms`)}>
            Back to floors
          </Button>
        }
      />
    )
  }

  const beds = rooms.flatMap((r) => r.beds)
  const occupied = rooms.reduce((sum, r) => sum + r.occupied_beds, 0)

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Properties', to: '/properties' },
          { label: pg?.name ?? 'Property', to: `/properties/${pgId}` },
          { label: 'Rooms', to: `/properties/${pgId}/rooms` },
          { label: floor.floor_label },
        ]}
      />

      {pg ? <PropertyBanner pg={pg} /> : null}

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">
            {floor.floor_label}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {rooms.length} room(s) · {beds.length} bed(s) in {buildingName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/properties/${pgId}/rooms`)}>
            ← All floors
          </Button>
          <Button onClick={() => setAddingRooms(true)}>+ Add room</Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Rooms" value={rooms.length} />
        <MetricCard label="Total beds" value={beds.length} />
        <MetricCard label="Occupied" value={occupied} tone="positive" />
        <MetricCard
          label="Monthly rent"
          value={formatRupees(floor.monthly_rent_total)}
          tone="muted"
          note="Sum of bed rents"
        />
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          title="No rooms on this floor yet"
          hint="Add the first room and its beds."
          action={<Button onClick={() => setAddingRooms(true)}>+ Add room</Button>}
        />
      ) : (
        <div className="space-y-4">
          {rooms.map((room) => (
            <RoomPanel
              key={room.id}
              room={room}
              pgId={pgId}
              onDelete={() => setPendingRoom(room)}
            />
          ))}
        </div>
      )}

      {addingRooms ? (
        <ConfigureFloorDrawer
          open
          pgId={pgId}
          floorId={floor.id}
          floorLabel={floor.floor_label}
          floorOrder={floor.floor_order}
          buildingName={buildingName}
          onClose={() => setAddingRooms(false)}
          onFloorConfigured={() => setAddingRooms(false)}
        />
      ) : null}

      {pendingRoom ? (
        <ConfirmDelete
          open
          itemKind="room"
          itemName={`Room ${pendingRoom.room_number}`}
          consequence={`and its ${pendingRoom.beds.length} bed(s) will be removed.`}
          requireTyping={pendingRoom.beds.length > 0}
          busy={deletingRoom}
          error={roomDeleteError}
          onCancel={() => setPendingRoom(null)}
          onConfirm={async () => {
            const ok = await deleteRoom({ roomId: pendingRoom.id, pgId })
              .unwrap()
              .then(() => true)
              .catch(() => false)
            if (ok) setPendingRoom(null)
          }}
        />
      ) : null}
    </>
  )
}

function RoomPanel({
  room,
  pgId,
  onDelete,
}: {
  room: RoomWithBeds
  pgId: string
  onDelete: () => void
}) {
  const [updateBedStatus] = useUpdateBedStatusMutation()
  const [generateBeds, { isLoading: generating }] = useGenerateBedsMutation()
  const [deleteBed, { isLoading: deletingBed, error: bedDeleteError }] =
    useDeleteBedMutation()
  const [pendingBed, setPendingBed] = useState<(typeof room.beds)[number] | null>(null)

  const missing = Math.max(0, room.total_beds - room.beds.length)

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Room {room.room_number}
            </h2>
            <Badge tone="blue">{room.room_type}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatRupees(room.monthly_rent)}/bed · {room.beds.length}/{room.total_beds}{' '}
            beds · {occupancyPercent(room.occupied_beds, room.beds.length)} occupied
            {room.description ? ` · ${room.description}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {missing > 0 ? (
            <Button
              variant="secondary"
              disabled={generating}
              onClick={() =>
                generateBeds({
                  roomId: room.id,
                  pgId,
                  bed_count: room.total_beds,
                  monthly_rent: room.monthly_rent,
                })
              }
            >
              {generating ? 'Creating…' : `Add ${missing} missing bed(s)`}
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete room ${room.room_number}`}
            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
              <path
                strokeWidth="1.8"
                strokeLinecap="round"
                d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"
              />
            </svg>
          </button>
        </div>
      </div>

      {room.beds.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
          No beds in this room yet.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {room.beds.map((bed) => (
            <div
              key={bed.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:border-slate-300"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{bed.bed_label}</p>
                <p className="tabular text-xs text-slate-500">
                  {formatRupees(bed.monthly_rent)}/mo
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone={BED_TONE[bed.status]}>{bed.status}</Badge>
                {bed.status !== 'occupied' ? (
                  <>
                    <button
                      type="button"
                      title={
                        bed.status === 'maintenance'
                          ? 'Mark available'
                          : 'Mark maintenance'
                      }
                      onClick={() =>
                        updateBedStatus({
                          bedId: bed.id,
                          pgId,
                          status: bed.status === 'maintenance' ? 'vacant' : 'maintenance',
                        })
                      }
                      className="rounded p-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      {bed.status === 'maintenance' ? '↺' : '⚑'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingBed(bed)}
                      aria-label={`Delete ${bed.bed_label}`}
                      className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      ×
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingBed ? (
        <ConfirmDelete
          open
          itemKind="bed"
          itemName={pendingBed.bed_label}
          requireTyping={false}
          busy={deletingBed}
          error={bedDeleteError}
          onCancel={() => setPendingBed(null)}
          onConfirm={async () => {
            const ok = await deleteBed({ bedId: pendingBed.id, pgId })
              .unwrap()
              .then(() => true)
              .catch(() => false)
            if (ok) setPendingBed(null)
          }}
        />
      ) : null}
    </Card>
  )
}
