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
  TextInput,
} from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import type { BedStatus, RoomWithBeds } from '@/types/api'
import { apiErrorMessage, formatRupees, occupancyPercent } from '@/utils/format'

import { StructureBuilder } from './StructureBuilder'
import {
  useCreateBedMutation,
  useListMyAssignedPGsQuery,
  useListPGsQuery,
  usePgRoomsQuery,
  useUpdateBedStatusMutation,
} from './propertiesApi'
import { pgSelected } from './selectedPgSlice'

const BED_TONE: Record<BedStatus, 'green' | 'amber' | 'slate'> = {
  occupied: 'green',
  vacant: 'amber',
  maintenance: 'slate',
}

/**
 * The Rooms & Beds screen, shared by owners and staff.
 *
 * Staff see exactly the same view for the PGs they are assigned to — they just
 * do not get the creation controls. The PGs they cannot reach are not merely
 * missing from the switcher: the API refuses them outright.
 */
export default function RoomsAndBedsPage({ canManage }: { canManage: boolean }) {
  const dispatch = useAppDispatch()
  const selectedPgId = useAppSelector((state) => state.selectedPg.selectedPgId)

  // Owners list every PG they own; staff list only their assignments.
  const ownerPGs = useListPGsQuery(undefined, { skip: !canManage })
  const staffPGs = useListMyAssignedPGsQuery(undefined, { skip: canManage })
  const availablePGs = (canManage ? ownerPGs.data : staffPGs.data) ?? []

  const activePgId = selectedPgId ?? availablePGs[0]?.id ?? null

  const { data, isLoading, isFetching } = usePgRoomsQuery(activePgId ?? '', {
    skip: !activePgId,
  })

  if (ownerPGs.isLoading || staffPGs.isLoading) return <Spinner label="Loading" />

  if (availablePGs.length === 0) {
    return (
      <EmptyState
        title={canManage ? 'No properties yet' : 'No PGs assigned to you'}
        hint={
          canManage
            ? 'Add a PG from the Properties screen first.'
            : 'Ask the owner to assign you to a property.'
        }
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Rooms & beds"
        description="Bed is the inventory unit — occupancy is read from bed status."
        action={
          <Select
            className="w-56"
            value={activePgId ?? ''}
            onChange={(event) => dispatch(pgSelected(event.target.value))}
          >
            {availablePGs.map((pg) => (
              <option key={pg.id} value={pg.id}>
                {pg.name}
              </option>
            ))}
          </Select>
        }
      />

      {isLoading ? (
        <Spinner label="Loading rooms" />
      ) : !data ? (
        <EmptyState title="Could not load this property" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total beds" value={data.total_beds} />
            <MetricCard
              label="Occupied"
              value={data.occupied_beds}
              tone="positive"
              note={`${occupancyPercent(data.occupied_beds, data.total_beds)} occupancy`}
            />
            <MetricCard label="Vacant" value={data.vacant_beds} tone="warning" />
            <MetricCard label="Maintenance" value={data.maintenance_beds} tone="muted" />
          </div>

          {canManage && activePgId ? (
            <div className="mt-6">
              <StructureBuilder pgId={activePgId} />
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {data.rooms.length === 0 ? (
              <EmptyState
                title="No rooms yet"
                hint={
                  canManage
                    ? 'Add a building, then a floor, then rooms and beds.'
                    : 'The owner has not set up rooms for this PG yet.'
                }
              />
            ) : (
              data.rooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  pgId={activePgId!}
                  canManage={canManage}
                  busy={isFetching}
                />
              ))
            )}
          </div>
        </>
      )}
    </>
  )
}

function RoomCard({
  room,
  pgId,
  canManage,
  busy,
}: {
  room: RoomWithBeds
  pgId: string
  canManage: boolean
  busy: boolean
}) {
  const [updateBedStatus, { error: statusError }] = useUpdateBedStatusMutation()
  const [createBed, { error: bedError }] = useCreateBedMutation()
  const [newBedLabel, setNewBedLabel] = useState('')
  const [newBedRent, setNewBedRent] = useState('')

  const roomIsFull = room.beds.length >= room.total_beds

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Room {room.room_number}
          </h3>
          <p className="text-sm text-slate-500">
            {room.building_name} · {room.floor_label} · {room.room_type} ·{' '}
            {room.beds.length}/{room.total_beds} beds created
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge tone="green">{room.occupied_beds} occupied</Badge>
          <Badge tone="amber">{room.vacant_beds} vacant</Badge>
          {room.maintenance_beds > 0 ? (
            <Badge tone="slate">{room.maintenance_beds} maintenance</Badge>
          ) : null}
        </div>
      </div>

      {statusError ? (
        <div className="mb-3">
          <ErrorNote>{apiErrorMessage(statusError, 'Could not update the bed')}</ErrorNote>
        </div>
      ) : null}
      {bedError ? (
        <div className="mb-3">
          <ErrorNote>{apiErrorMessage(bedError, 'Could not add the bed')}</ErrorNote>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {room.beds.map((bed) => (
          <div
            key={bed.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">{bed.bed_label}</p>
              <p className="text-xs text-slate-500">{formatRupees(bed.monthly_rent)}/mo</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={BED_TONE[bed.status]}>{bed.status}</Badge>
              {/* Occupied beds are left alone: a bed empties by vacating its
                  tenant (Phase 2), not by toggling a status here. */}
              {bed.status !== 'occupied' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    updateBedStatus({
                      bedId: bed.id,
                      pgId,
                      status: bed.status === 'maintenance' ? 'vacant' : 'maintenance',
                    })
                  }
                  className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                >
                  {bed.status === 'maintenance' ? 'Mark vacant' : 'Mark maintenance'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {canManage && !roomIsFull ? (
        <form
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!newBedLabel.trim()) return
            try {
              await createBed({
                roomId: room.id,
                pgId,
                bed_label: newBedLabel.trim(),
                monthly_rent: newBedRent || null,
              }).unwrap()
              setNewBedLabel('')
              setNewBedRent('')
            } catch {
              /* surfaced above */
            }
          }}
        >
          <div className="w-36">
            <Field label="Bed label">
              <TextInput
                value={newBedLabel}
                onChange={(event) => setNewBedLabel(event.target.value)}
                placeholder="Bed A"
              />
            </Field>
          </div>
          <div className="w-36">
            <Field label="Monthly rent">
              <TextInput
                value={newBedRent}
                onChange={(event) => setNewBedRent(event.target.value)}
                inputMode="decimal"
                placeholder="8000"
              />
            </Field>
          </div>
          <Button type="submit" variant="secondary">
            Add bed
          </Button>
        </form>
      ) : null}

      {canManage && roomIsFull ? (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          This room is at its declared capacity of {room.total_beds} bed(s).
        </p>
      ) : null}
    </Card>
  )
}
