import { useState } from 'react'

import {
  Button,
  Card,
  CardTitle,
  ErrorNote,
  Field,
  Select,
  TextInput,
} from '@/components/ui'
import { apiErrorMessage } from '@/utils/format'

import {
  useCreateBedMutation,
  useCreateBuildingMutation,
  useCreateFloorMutation,
  useCreateRoomMutation,
  useListBuildingsQuery,
  useListPgFloorsQuery,
  usePgRoomsQuery,
} from './propertiesApi'

/**
 * Building → Floor → Room → Bed, the full chain an owner has to build.
 *
 * Every dropdown reads from the server rather than from what happened to be
 * created in this browser session. That distinction matters: an earlier version
 * remembered floors locally, so reloading the page made saved floors disappear
 * from the picker and the owner had no way to add rooms to them. State that
 * lives only in a component cannot survive a refresh, and structure is exactly
 * the kind of thing people build across several sittings.
 *
 * The four steps are separate submits because the API models them as four
 * resources — collapsing them into one form would hide which step failed.
 */
export function StructureBuilder({ pgId }: { pgId: string }) {
  const { data: buildings = [] } = useListBuildingsQuery(pgId)
  const { data: floors = [] } = useListPgFloorsQuery(pgId)
  const { data: rooms } = usePgRoomsQuery(pgId)

  const [createBuilding, { isLoading: savingBuilding, error: buildingError }] =
    useCreateBuildingMutation()
  const [createFloor, { isLoading: savingFloor, error: floorError }] =
    useCreateFloorMutation()
  const [createRoom, { isLoading: savingRoom, error: roomError }] = useCreateRoomMutation()
  const [createBed, { isLoading: savingBed, error: bedError }] = useCreateBedMutation()

  const [buildingName, setBuildingName] = useState('')
  const [floorBuildingId, setFloorBuildingId] = useState('')
  const [floorLabel, setFloorLabel] = useState('')
  const [roomFloorId, setRoomFloorId] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [roomType, setRoomType] = useState('double')
  const [roomBeds, setRoomBeds] = useState('2')
  const [bedRoomId, setBedRoomId] = useState('')
  const [bedLabel, setBedLabel] = useState('')
  const [bedRent, setBedRent] = useState('')

  const error = buildingError ?? floorError ?? roomError ?? bedError

  const roomList = rooms?.rooms ?? []
  const selectedRoom = roomList.find((room) => room.id === bedRoomId)
  const roomIsFull = selectedRoom
    ? selectedRoom.beds.length >= selectedRoom.total_beds
    : false

  return (
    <Card>
      <CardTitle>Add structure</CardTitle>
      <p className="-mt-2 mb-5 text-sm text-slate-600">
        A bed lives inside a room, on a floor, in a building — so build it in that
        order. Each step unlocks the next.
      </p>

      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not save')}</ErrorNote>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* ---------------------------------------------------- 1. Building */}
        <StepColumn number={1} label="Building" hint={`${buildings.length} added`}>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              const name = buildingName.trim() || 'Main Building'
              const created = await createBuilding({ pgId, name })
                .unwrap()
                .catch(() => undefined)
              if (created) {
                setBuildingName('')
                // Preselect it, so the next step is ready without a hunt.
                setFloorBuildingId(created.id)
              }
            }}
          >
            <Field label="Building name" hint="Defaults to “Main Building”.">
              <TextInput
                value={buildingName}
                onChange={(event) => setBuildingName(event.target.value)}
                placeholder="Main Building"
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={savingBuilding}>
              {savingBuilding ? 'Adding…' : 'Add building'}
            </Button>
          </form>
        </StepColumn>

        {/* ------------------------------------------------------- 2. Floor */}
        <StepColumn number={2} label="Floor" hint={`${floors.length} added`}>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!floorBuildingId || !floorLabel.trim()) return
              const siblings = floors.filter((f) => f.building_id === floorBuildingId)
              const created = await createFloor({
                buildingId: floorBuildingId,
                pgId,
                floor_label: floorLabel.trim(),
                floor_order: siblings.length + 1,
              })
                .unwrap()
                .catch(() => undefined)
              if (created) {
                setFloorLabel('')
                setRoomFloorId(created.id)
              }
            }}
          >
            <Field
              label="Building"
              hint={buildings.length === 0 ? 'Add a building first.' : undefined}
            >
              <Select
                value={floorBuildingId}
                onChange={(event) => setFloorBuildingId(event.target.value)}
                disabled={buildings.length === 0}
              >
                <option value="">Select a building…</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Floor label">
              <TextInput
                value={floorLabel}
                onChange={(event) => setFloorLabel(event.target.value)}
                placeholder="1st Floor"
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={!floorBuildingId || savingFloor}
            >
              {savingFloor ? 'Adding…' : 'Add floor'}
            </Button>
          </form>
        </StepColumn>

        {/* -------------------------------------------------------- 3. Room */}
        <StepColumn number={3} label="Room" hint={`${roomList.length} added`}>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!roomFloorId || !roomNumber.trim()) return
              const created = await createRoom({
                floorId: roomFloorId,
                pgId,
                room_number: roomNumber.trim(),
                room_type: roomType,
                total_beds: Number(roomBeds) || 1,
              })
                .unwrap()
                .catch(() => undefined)
              if (created) {
                setRoomNumber('')
                setBedRoomId(created.id)
              }
            }}
          >
            <Field
              label="Floor"
              hint={floors.length === 0 ? 'Add a floor first.' : undefined}
            >
              <Select
                value={roomFloorId}
                onChange={(event) => setRoomFloorId(event.target.value)}
                disabled={floors.length === 0}
              >
                <option value="">Select a floor…</option>
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {/* Building name included: "1st Floor" alone is ambiguous
                        as soon as a PG has two buildings. */}
                    {floor.building_name} · {floor.floor_label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Room number">
              <TextInput
                value={roomNumber}
                onChange={(event) => setRoomNumber(event.target.value)}
                placeholder="101"
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <Select
                  value={roomType}
                  onChange={(event) => setRoomType(event.target.value)}
                >
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="triple">Triple</option>
                  <option value="sharing">Sharing</option>
                </Select>
              </Field>
              <Field label="Total beds">
                <TextInput
                  value={roomBeds}
                  onChange={(event) => setRoomBeds(event.target.value)}
                  inputMode="numeric"
                />
              </Field>
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={!roomFloorId || savingRoom}
            >
              {savingRoom ? 'Adding…' : 'Add room'}
            </Button>
          </form>
        </StepColumn>

        {/* --------------------------------------------------------- 4. Bed */}
        <StepColumn number={4} label="Bed" hint={`${rooms?.total_beds ?? 0} added`}>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              if (!bedRoomId || !bedLabel.trim()) return
              const created = await createBed({
                roomId: bedRoomId,
                pgId,
                bed_label: bedLabel.trim(),
                monthly_rent: bedRent || null,
              })
                .unwrap()
                .catch(() => undefined)
              if (created) {
                setBedLabel('')
                setBedRent('')
              }
            }}
          >
            <Field
              label="Room"
              hint={roomList.length === 0 ? 'Add a room first.' : undefined}
            >
              <Select
                value={bedRoomId}
                onChange={(event) => setBedRoomId(event.target.value)}
                disabled={roomList.length === 0}
              >
                <option value="">Select a room…</option>
                {roomList.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.room_number} ({room.beds.length}/{room.total_beds})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bed label">
              <TextInput
                value={bedLabel}
                onChange={(event) => setBedLabel(event.target.value)}
                placeholder="Bed A"
              />
            </Field>
            <Field label="Monthly rent" hint="Optional — per bed, in ₹.">
              <TextInput
                value={bedRent}
                onChange={(event) => setBedRent(event.target.value)}
                inputMode="decimal"
                placeholder="8000"
              />
            </Field>
            {roomIsFull ? (
              <p className="text-xs text-amber-700">
                Room {selectedRoom?.room_number} already has all{' '}
                {selectedRoom?.total_beds} of its declared beds.
              </p>
            ) : null}
            <Button
              type="submit"
              variant="secondary"
              disabled={!bedRoomId || roomIsFull || savingBed}
            >
              {savingBed ? 'Adding…' : 'Add bed'}
            </Button>
          </form>
        </StepColumn>
      </div>
    </Card>
  )
}

function StepColumn({
  number,
  label,
  hint,
  children,
}: {
  number: number
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {number}
        </span>
        <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
          {label}
        </span>
        {hint ? <span className="text-xs text-slate-400">· {hint}</span> : null}
      </div>
      {children}
    </div>
  )
}
