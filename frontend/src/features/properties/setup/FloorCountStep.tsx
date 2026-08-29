import { useState } from 'react'

import { Button, ErrorNote, Field, TextInput } from '@/components/ui'
import { apiErrorMessage } from '@/utils/format'

import { useGenerateFloorsMutation, useListPgFloorsQuery } from '../propertiesApi'

/**
 * Guide 3.3 — the owner gives a count, the system creates Floor 1..N.
 *
 * Deliberately not a "add a floor" form repeated N times. Buildings have a
 * floor count, not a list of individually-named floors, and asking for the
 * number once matches how an owner already thinks about the property.
 */
export function FloorCountStep({
  pgId,
  buildingId,
  buildingName,
  onGenerated,
  onBack,
}: {
  pgId: string
  buildingId: string
  buildingName: string
  onGenerated: () => void
  onBack: () => void
}) {
  const { data: allFloors = [] } = useListPgFloorsQuery(pgId)
  const [generateFloors, { isLoading, error }] = useGenerateFloorsMutation()

  const existing = allFloors.filter((f) => f.building_id === buildingId)
  const [count, setCount] = useState(String(Math.max(existing.length, 1)))

  const parsed = Number(count)
  const valid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 50

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">Number of floors</h2>
      <p className="mt-1 mb-5 text-sm text-slate-600">
        How many floors does {buildingName} have?
      </p>

      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not create the floors')}</ErrorNote>
        </div>
      ) : null}

      {/* The steppers sit outside the Field on purpose: a <label> that wraps
          several controls binds to the first one, which would have made this
          label point at the minus button instead of the number itself. */}
      <div className="flex max-w-xs items-end gap-2">
        <Button
          type="button"
          variant="secondary"
          aria-label="Decrease floor count"
          onClick={() => setCount(String(Math.max(1, parsed - 1)))}
          disabled={!valid || parsed <= 1}
        >
          −
        </Button>
        <div className="flex-1">
          <Field label="Number of floors" required>
            <TextInput
              className="text-center"
              inputMode="numeric"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </Field>
        </div>
        <Button
          type="button"
          variant="secondary"
          aria-label="Increase floor count"
          onClick={() => setCount(String(Math.min(50, parsed + 1)))}
          disabled={!valid || parsed >= 50}
        >
          +
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        The system will create Floor 1 to Floor {valid ? parsed : 'N'}.
      </p>

      {existing.length > 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {buildingName} already has {existing.length} floor(s). Raising the number adds
          the missing ones — floors you have already configured are left alone.
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          disabled={!valid || isLoading}
          onClick={async () => {
            const created = await generateFloors({
              buildingId,
              pgId,
              floor_count: parsed,
            })
              .unwrap()
              .catch(() => undefined)
            if (created) onGenerated()
          }}
        >
          {isLoading ? 'Creating…' : 'Generate floors'}
        </Button>
      </div>
    </div>
  )
}
