import { useNavigate } from 'react-router-dom'

import { Button, MetricCard } from '@/components/ui'
import type { PGSummary } from '@/types/api'

import { useFloorOverviewQuery, useGetPGQuery, usePgStructureQuery } from '../propertiesApi'

/** The "PG Setup Complete" screen from the wireframe, with the real totals. */
export function CompleteStep({ pg }: { pg: PGSummary }) {
  const navigate = useNavigate()
  const { data: current } = useGetPGQuery(pg.id)
  const { data: buildings = [] } = usePgStructureQuery(pg.id)
  const { data: floors = [] } = useFloorOverviewQuery(pg.id)

  const totals = current ?? pg
  const rooms = buildings.reduce((sum, b) => sum + b.room_count, 0)

  return (
    <div className="rounded-2xl bg-linear-to-b from-emerald-50 to-white px-6 py-10 text-center">
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 text-4xl text-white shadow-lg shadow-emerald-600/25">
        ✓
      </div>
      <h2 className="text-3xl font-extrabold tracking-tight text-navy-900">
        Congratulations!
      </h2>
      <p className="mx-auto mt-2 max-w-md text-base text-slate-600">
        <span className="font-semibold text-slate-800">{totals.name}</span> is set up. You
        can now manage it from its own workspace.
      </p>

      <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-4">
        <MetricCard label="Buildings" value={buildings.length} />
        <MetricCard label="Floors" value={floors.length} />
        <MetricCard label="Rooms" value={rooms} />
        <MetricCard label="Beds" value={totals.total_beds} tone="positive" />
      </div>

      <div className="mt-9 flex flex-wrap justify-center gap-2">
        <Button onClick={() => navigate(`/properties/${pg.id}`)}>Go to PG workspace</Button>
        <Button variant="secondary" onClick={() => navigate('/properties')}>
          All properties
        </Button>
        <Button variant="secondary" onClick={() => navigate('/staff')}>
          Add staff
        </Button>
      </div>
    </div>
  )
}
