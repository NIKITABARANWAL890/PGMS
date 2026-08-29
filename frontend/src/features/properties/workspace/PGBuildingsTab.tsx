import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorNote,
  Field,
  Spinner,
  TextInput,
} from '@/components/ui'
import { apiErrorMessage, occupancyPercent } from '@/utils/format'

import {
  useCreateBuildingMutation,
  useFloorOverviewQuery,
  useGenerateFloorsMutation,
  usePgStructureQuery,
} from '../propertiesApi'
import { usePGWorkspace } from './context'

/** Guide 7 — manage the physical structure: buildings, their floors, and counts. */
export default function PGBuildingsTab() {
  const { pg } = usePGWorkspace()
  const navigate = useNavigate()
  const { data: buildings = [], isLoading } = usePgStructureQuery(pg.id)
  const { data: floors = [] } = useFloorOverviewQuery(pg.id)

  const [createBuilding, { isLoading: creating, error: createError }] =
    useCreateBuildingMutation()
  const [generateFloors, { isLoading: generating, error: floorError }] =
    useGenerateFloorsMutation()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [floorCounts, setFloorCounts] = useState<Record<string, string>>({})

  const error = createError ?? floorError

  if (isLoading) return <Spinner label="Loading structure" />

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {buildings.length} building(s), {floors.length} floor(s).
        </p>
        <Button onClick={() => setShowForm((open) => !open)}>
          {showForm ? 'Cancel' : '+ Add building'}
        </Button>
      </div>

      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not save')}</ErrorNote>
        </div>
      ) : null}

      {showForm ? (
        <Card className="mb-5">
          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!name.trim()) return
              const created = await createBuilding({
                pgId: pg.id,
                name: name.trim(),
                building_code: code.trim() || null,
              })
                .unwrap()
                .catch(() => undefined)
              if (created) {
                setName('')
                setCode('')
                setShowForm(false)
              }
            }}
          >
            <Field label="Building name" required>
              <TextInput
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Main Building"
              />
            </Field>
            <Field label="Building code" hint="Optional.">
              <TextInput
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="MB-01"
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit" disabled={!name.trim() || creating}>
                {creating ? 'Adding…' : 'Add building'}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {buildings.length === 0 ? (
        <EmptyState
          title="No buildings yet"
          hint="Add a building, then give it a floor count."
        />
      ) : (
        <div className="space-y-4">
          {buildings.map((building) => {
            const buildingFloors = floors.filter((f) => f.building_id === building.id)
            const countValue =
              floorCounts[building.id] ?? String(Math.max(buildingFloors.length, 1))

            return (
              <Card key={building.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>
                      {building.name}
                      {building.building_code ? (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          ({building.building_code})
                        </span>
                      ) : null}
                    </CardTitle>
                    <p className="-mt-2 text-sm text-slate-500">
                      {building.floor_count} floors · {building.room_count} rooms ·{' '}
                      {building.bed_count} beds ·{' '}
                      {occupancyPercent(building.occupied_beds, building.bed_count)} occupied
                    </p>
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="w-28">
                      <Field label="Floors">
                        <TextInput
                          inputMode="numeric"
                          value={countValue}
                          onChange={(event) =>
                            setFloorCounts((prev) => ({
                              ...prev,
                              [building.id]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={generating}
                      onClick={() =>
                        generateFloors({
                          buildingId: building.id,
                          pgId: pg.id,
                          floor_count: Number(countValue) || 1,
                        })
                      }
                    >
                      {generating ? 'Saving…' : 'Set floors'}
                    </Button>
                  </div>
                </div>

                {buildingFloors.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No floors yet — set a floor count above.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
                          <th className="py-2 pr-3">Floor</th>
                          <th className="py-2 pr-3">Status</th>
                          <th className="py-2 pr-3 text-right">Rooms</th>
                          <th className="py-2 pr-3 text-right">Beds</th>
                          <th className="py-2 pr-3 text-right">Occupancy</th>
                          <th className="py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buildingFloors.map((floor) => (
                          <tr
                            key={floor.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="py-2.5 pr-3 font-medium text-slate-800">
                              {floor.floor_label}
                            </td>
                            <td className="py-2.5 pr-3">
                              {floor.room_count > 0 ? (
                                <Badge tone="green">Configured</Badge>
                              ) : (
                                <Badge tone="amber">Not configured</Badge>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-right">{floor.room_count}</td>
                            <td className="py-2.5 pr-3 text-right">{floor.bed_count}</td>
                            <td className="py-2.5 pr-3 text-right">
                              {occupancyPercent(floor.occupied_beds, floor.bed_count)}
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => navigate(`../rooms?floor=${floor.id}`)}
                                className="text-sm font-medium text-brand-600 hover:underline"
                              >
                                Manage rooms
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
