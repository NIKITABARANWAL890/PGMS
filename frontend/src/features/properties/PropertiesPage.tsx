import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Badge, Button, ConfirmDelete, EmptyState, Spinner } from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'
import { IconBuilding, IconChevronDown } from '@/components/ui/icons'
import { pgSelected } from '@/features/properties/selectedPgSlice'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import type { PGSummary } from '@/types/api'

import { useDeletePGMutation, useListPGsQuery } from './propertiesApi'

const PG_TYPE_LABEL: Record<string, string> = {
  girls: 'Girls',
  boys: 'Boys',
  co_living: 'Co-living',
}

export default function PropertiesPage() {
  const { data: pgs = [], isLoading } = useListPGsQuery()
  const selectedPgId = useAppSelector((state) => state.selectedPg.selectedPgId)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState<PGSummary | null>(null)

  // This filter is entirely local to this page now — there is no navbar
  // switcher keeping it in sync with anything else, so choosing a PG here
  // only ever narrows this list, nothing more.
  const visible = selectedPgId ? pgs.filter((pg) => pg.id === selectedPgId) : pgs

  return (
    <>
      <PageHeader
        title="Properties"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Properties' }]}
        description="Every PG on this account. Open one to manage its structure."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PGFilter
          pgs={pgs}
          value={selectedPgId}
          onChange={(id) => dispatch(pgSelected(id))}
        />
        <Button onClick={() => navigate('/properties/new')}>+ Add PG</Button>
      </div>

      {isLoading ? (
        <Spinner label="Loading properties" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={pgs.length === 0 ? 'No properties yet' : 'That property no longer exists'}
          hint={
            pgs.length === 0
              ? 'Use “Add PG” to run through the guided setup — details, buildings, floors, rooms and beds.'
              : 'It may have been deleted. Switch back to all properties to continue.'
          }
          action={
            pgs.length === 0 ? (
              <Button onClick={() => navigate('/properties/new')}>+ Add PG</Button>
            ) : (
              <Button variant="secondary" onClick={() => dispatch(pgSelected(null))}>
                Show all properties
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((pg) => (
            <PropertyCard
              key={pg.id}
              pg={pg}
              onOpen={() => navigate(`/properties/${pg.id}`)}
              onDelete={() => setPendingDelete(pg)}
            />
          ))}
        </div>
      )}

      {pendingDelete ? (
        <DeletePGDialog pg={pendingDelete} onClose={() => setPendingDelete(null)} />
      ) : null}
    </>
  )
}

/**
 * The "which properties am I looking at" control — left-aligned, above the
 * grid, with "+ Add PG" at the opposite end of the same row.
 *
 * Built as a real listbox rather than a native `<select>` layered under a
 * styled trigger: that trick hands the actual dropdown list to the browser,
 * which on Windows renders it with almost no control over row padding — every
 * option reads as cramped no matter how the trigger above it looks. A custom
 * list gives every row the same spacing as everywhere else in the app.
 */
function PGFilter({
  pgs,
  value,
  onChange,
}: {
  pgs: PGSummary[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (pgs.length === 0) return <div />

  const currentLabel = value ? (pgs.find((pg) => pg.id === value)?.name ?? 'All PGs') : 'All PGs'

  const select = (id: string | null) => {
    onChange(id)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pr-3 pl-3.5 text-sm transition-colors hover:border-slate-300"
      >
        <IconBuilding className="h-4 w-4 text-slate-400" />
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Viewing
        </span>
        <span className="max-w-40 truncate font-semibold text-slate-800">{currentLabel}</span>
        <IconChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Filter properties"
          className="animate-pop-in absolute top-full left-0 z-30 mt-2 max-h-80 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === null}
            onClick={() => select(null)}
            className={[
              'block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
              value === null
                ? 'bg-brand-50 font-semibold text-brand-700'
                : 'text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            All PGs
          </button>
          {pgs.map((pg) => (
            <button
              key={pg.id}
              type="button"
              role="option"
              aria-selected={value === pg.id}
              onClick={() => select(pg.id)}
              className={[
                'block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition-colors',
                value === pg.id
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {pg.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * A property as a card rather than a table row.
 *
 * A PG is a thing with a handful of attributes people scan — name, type,
 * where it is, how full it is — not a record compared column-by-column against
 * its neighbours. Cards also give the occupancy bar somewhere to live, which is
 * the one number an owner actually looks for on this screen.
 */
function PropertyCard({
  pg,
  onOpen,
  onDelete,
}: {
  pg: PGSummary
  onOpen: () => void
  onDelete: () => void
}) {
  const percent = pg.total_beds
    ? Math.round((pg.occupied_beds / pg.total_beds) * 100)
    : 0

  return (
    <div className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex items-center justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onOpen}
            className="text-left text-base font-semibold tracking-tight text-slate-900 hover:text-brand-600"
          >
            {pg.name}
          </button>
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {[pg.address, pg.city].filter(Boolean).join(', ')}
          </p>
        </div>
        {pg.pg_type ? (
          <Badge tone="blue">{PG_TYPE_LABEL[pg.pg_type] ?? pg.pg_type}</Badge>
        ) : null}
      </div>

      <div className="px-5">
        <div className="mb-1.5 flex items-baseline justify-between text-xs">
          <span className="font-medium text-slate-600">
            {pg.total_beds === 0 ? 'No beds yet' : `${percent}% occupied`}
          </span>
          <span className="tabular text-slate-500">
            {pg.occupied_beds}/{pg.total_beds} beds
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`${percent}% of beds occupied`}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
        <Stat label="Total" value={pg.total_beds} />
        <Stat label="Occupied" value={pg.occupied_beds} tone="text-emerald-600" />
        <Stat label="Vacant" value={pg.vacant_beds} tone="text-amber-600" />
      </dl>

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <button
          type="button"
          onClick={onOpen}
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Open workspace →
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${pg.name}`}
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
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="py-3">
      <dd className={`tabular text-lg font-semibold ${tone ?? 'text-slate-900'}`}>
        {value}
      </dd>
      <dt className="text-[11px] tracking-wide text-slate-500 uppercase">{label}</dt>
    </div>
  )
}

function DeletePGDialog({ pg, onClose }: { pg: PGSummary; onClose: () => void }) {
  const [deletePG, { isLoading, error }] = useDeletePGMutation()
  const dispatch = useAppDispatch()
  const selectedPgId = useAppSelector((state) => state.selectedPg.selectedPgId)

  return (
    <ConfirmDelete
      open
      itemKind="property"
      itemName={pg.name}
      consequence={`and its ${pg.total_beds} bed(s), rooms, floors and buildings will be permanently removed.`}
      busy={isLoading}
      error={error}
      onCancel={onClose}
      onConfirm={async () => {
        const ok = await deletePG(pg.id)
          .unwrap()
          .then(() => true)
          .catch(() => false)
        if (ok) {
          // Clear the scope if it pointed at the PG that just went away,
          // otherwise the list filters to something that no longer exists.
          if (selectedPgId === pg.id) dispatch(pgSelected(null))
          onClose()
        }
      }}
    />
  )
}

export { PropertyCard }
