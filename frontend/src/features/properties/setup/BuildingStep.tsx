import { useState } from 'react'

import { Button, ErrorNote, Field, TextInput } from '@/components/ui'
import type { PGSummary } from '@/types/api'
import { apiErrorMessage } from '@/utils/format'

import { useCreateBuildingMutation, useListBuildingsQuery } from '../propertiesApi'

/**
 * Guide 3.2 — Single Building or Multiple Buildings.
 *
 * Single is the common case and costs the owner nothing: the system creates
 * "Main Building" itself and moves straight on. Multiple is the only path that
 * asks for names, and only then because there is genuinely more than one.
 */
export function BuildingStep({
  pg,
  onReady,
  onBack,
}: {
  pg: PGSummary
  onReady: (buildingId: string, buildingName: string) => void
  onBack: () => void
}) {
  const { data: buildings = [] } = useListBuildingsQuery(pg.id)
  const [createBuilding, { isLoading, error }] = useCreateBuildingMutation()

  const [mode, setMode] = useState<'single' | 'multiple'>('single')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const addBuilding = async (buildingName: string, buildingCode: string | null) => {
    const created = await createBuilding({
      pgId: pg.id,
      name: buildingName,
      building_code: buildingCode,
    })
      .unwrap()
      .catch(() => undefined)
    return created
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">Building details</h2>
      <p className="mt-1 mb-5 text-sm text-slate-600">
        Does {pg.name} have one building or several?
      </p>

      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not save the building')}</ErrorNote>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {(['single', 'multiple'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={[
              'rounded-lg border px-4 py-2 text-sm transition-colors',
              mode === option
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {option === 'single' ? 'Single building' : 'Multiple buildings'}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            A building named <strong>Main Building</strong> will be created for you.
          </p>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="secondary" onClick={onBack}>
              Back
            </Button>
            <Button
              type="button"
              disabled={isLoading}
              onClick={async () => {
                // Reuse an existing Main Building rather than adding a second
                // one if the owner steps back into this screen.
                const existing = buildings.find((b) => b.name === 'Main Building')
                if (existing) {
                  onReady(existing.id, existing.name)
                  return
                }
                const created = await addBuilding('Main Building', null)
                if (created) onReady(created.id, created.name)
              }}
            >
              {isLoading ? 'Creating…' : 'Save & next'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!name.trim()) return
              const created = await addBuilding(name.trim(), code.trim() || null)
              if (created) {
                setName('')
                setCode('')
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
            <Field label="Building code" hint="Optional, e.g. MB-01.">
              <TextInput
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="MB-01"
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={!name.trim() || isLoading}>
              {isLoading ? 'Adding…' : 'Add building'}
            </Button>
          </form>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Buildings added ({buildings.length})
            </p>
            {buildings.length === 0 ? (
              <p className="text-sm text-slate-500">
                None yet. Add at least one to continue.
              </p>
            ) : (
              <ul className="space-y-2">
                {buildings.map((building) => (
                  <li
                    key={building.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium text-slate-800">{building.name}</span>
                      {building.building_code ? (
                        <span className="ml-2 text-xs text-slate-500">
                          {building.building_code}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onReady(building.id, building.name)}
                    >
                      Continue →
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {/* Guide 3.2: with several buildings the owner picks one to continue
                with, because floors are entered per building. */}
            {buildings.length > 1 ? (
              <p className="mt-3 text-xs text-slate-500">
                Pick the building to set up first. You can come back for the others.
              </p>
            ) : null}

            <div className="mt-4">
              <Button type="button" variant="secondary" onClick={onBack}>
                Back
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
