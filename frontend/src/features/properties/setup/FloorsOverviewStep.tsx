import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge, Button, ConfirmDelete, EmptyState, Spinner } from '@/components/ui'
import type { FloorOverview } from '@/types/api'
import { formatRupees } from '@/utils/format'

import {
  useDeleteFloorMutation,
  useFloorOverviewQuery,
  useListBuildingsQuery,
} from '../propertiesApi'
import { ConfigureFloorDrawer } from './ConfigureFloorDrawer'

/**
 * Guide 3.4 — the Floors Overview, and the hub the setup loop returns to.
 *
 * "Not Configured" is read from the floor's room count rather than stored as a
 * status, so it cannot disagree with what is actually on the floor. A stored
 * flag would need updating on every room add and delete, and would be wrong the
 * first time one of those paths forgot.
 *
 * Configuring opens a drawer over this list rather than navigating away: the
 * list is the thing you come back to after every floor, so keeping it on screen
 * is what makes the loop feel like a loop.
 */
export function FloorsOverviewStep({
  pgId,
  onAddBuilding,
  onFinish,
  /** Set when this is used inside the property workspace rather than setup. */
  workspaceMode = false,
}: {
  pgId: string
  onAddBuilding?: () => void
  onFinish?: () => void
  workspaceMode?: boolean
}) {
  const navigate = useNavigate()
  const { data: floors = [], isLoading } = useFloorOverviewQuery(pgId)
  const { data: buildings = [] } = useListBuildingsQuery(pgId)
  const [deleteFloor, { isLoading: deleting, error: deleteError }] =
    useDeleteFloorMutation()

  const [configuring, setConfiguring] = useState<FloorOverview | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FloorOverview | null>(null)

  const buildingName = (buildingId: string) =>
    buildings.find((b) => b.id === buildingId)?.name ?? 'Building'

  const configured = floors.filter((f) => f.room_count > 0).length

  if (isLoading) return <Spinner label="Loading floors" />

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Floors overview
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Configure a floor to add its rooms and beds. Floors can be set up in
            any order.
          </p>
        </div>
        <Badge tone={configured === floors.length && floors.length > 0 ? 'green' : 'slate'}>
          {configured} of {floors.length} configured
        </Badge>
      </div>

      {floors.length === 0 ? (
        <EmptyState
          title="No floors yet"
          hint={
            workspaceMode
              ? 'Set a floor count on the Buildings & Floors tab.'
              : 'Go back a step and enter how many floors this building has.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {floors.map((floor) => (
            <FloorCard
              key={floor.id}
              floor={floor}
              buildingName={buildingName(floor.building_id)}
              onConfigure={() => setConfiguring(floor)}
              onOpen={() => navigate(`/properties/${pgId}/floors/${floor.id}`)}
              onDelete={() => setPendingDelete(floor)}
            />
          ))}
        </div>
      )}

      {!workspaceMode ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {onAddBuilding ? (
            <Button variant="secondary" onClick={onAddBuilding}>
              + Add another building
            </Button>
          ) : null}
          {onFinish ? (
            <Button onClick={onFinish} disabled={configured === 0}>
              Finish setup
            </Button>
          ) : null}
          {configured === 0 ? (
            <p className="w-full text-xs text-slate-500">
              Configure at least one floor before finishing.
            </p>
          ) : null}
        </div>
      ) : null}

      {configuring ? (
        <ConfigureFloorDrawer
          open
          pgId={pgId}
          floorId={configuring.id}
          floorLabel={configuring.floor_label}
          floorOrder={configuring.floor_order}
          buildingName={buildingName(configuring.building_id)}
          onClose={() => setConfiguring(null)}
          onFloorConfigured={() => setConfiguring(null)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDelete
          open
          itemKind="floor"
          itemName={pendingDelete.floor_label}
          consequence={
            pendingDelete.room_count > 0
              ? `and its ${pendingDelete.room_count} room(s) and ${pendingDelete.bed_count} bed(s) will be removed.`
              : 'will be removed.'
          }
          requireTyping={pendingDelete.room_count > 0}
          busy={deleting}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const ok = await deleteFloor({ floorId: pendingDelete.id, pgId })
              .unwrap()
              .then(() => true)
              .catch(() => false)
            if (ok) setPendingDelete(null)
          }}
        />
      ) : null}
    </div>
  )
}

function FloorCard({
  floor,
  buildingName,
  onConfigure,
  onOpen,
  onDelete,
}: {
  floor: FloorOverview
  buildingName: string
  onConfigure: () => void
  onOpen: () => void
  onDelete: () => void
}) {
  const isConfigured = floor.room_count > 0
  // Floors are always generated as "Floor N" (see nextRoomNumbers/generate
  // floors), so the numeral is the one thing worth pulling out for its own
  // badge — a hand-renamed floor without a digit just shows none.
  const floorNumber = floor.floor_label.match(/\d+/)?.[0]

  return (
    <article
      aria-label={`${floor.floor_label}, ${buildingName}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-card ring-1 ring-slate-900/2 transition-shadow duration-200 hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="flex items-center gap-3">
          {floorNumber ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
              {floorNumber}
            </span>
          ) : null}
          <div>
            <button
              type="button"
              onClick={isConfigured ? onOpen : onConfigure}
              className="text-left text-sm font-bold tracking-tight text-navy-900 hover:text-brand-600"
            >
              {floor.floor_label}
            </button>
            <p className="mt-0.5 text-xs text-slate-500">{buildingName}</p>
          </div>
        </div>
        {isConfigured ? (
          <Badge tone="green">Configured</Badge>
        ) : (
          <Badge tone="amber">Not configured</Badge>
        )}
      </div>

      <dl className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
        <MiniStat label="Rooms" value={floor.room_count} />
        <MiniStat label="Beds" value={floor.bed_count} />
        <MiniStat label="Occupied" value={floor.occupied_beds} />
      </dl>

      {isConfigured ? (
        <p className="border-t border-slate-100 px-4 py-2 text-center text-xs text-slate-500">
          {formatRupees(floor.monthly_rent_total)} total monthly rent
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={isConfigured ? onOpen : onConfigure}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          {isConfigured ? 'View details →' : 'Configure'}
        </button>
        <div className="flex items-center gap-1.5">
          {isConfigured ? (
            <Button variant="secondary" onClick={onConfigure}>
              + Room
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${floor.floor_label}`}
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
    </article>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="py-2.5">
      <dd className="tabular text-base font-semibold text-slate-900">{value}</dd>
      <dt className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</dt>
    </div>
  )
}
