import { useState } from 'react'

import {
  Badge,
  Button,
  Drawer,
  ErrorNote,
  Field,
  Select,
  TextInput,
} from '@/components/ui'
import type { Bed, Room, RoomType } from '@/types/api'
import { apiErrorMessage, formatRupees } from '@/utils/format'

import {
  useCreateRoomMutation,
  useGenerateBedsMutation,
  useListFloorRoomsQuery,
  useListRoomBedsQuery,
} from '../propertiesApi'

const ROOM_TYPES: { value: RoomType; label: string; beds: number }[] = [
  { value: 'single', label: 'Single', beds: 1 },
  { value: 'double', label: 'Double', beds: 2 },
  { value: 'triple', label: 'Triple', beds: 3 },
  { value: 'sharing', label: 'Sharing', beds: 4 },
]

type Stage = 'count' | 'room' | 'ask-beds' | 'beds' | 'summary'

/**
 * Numbers rooms the way the guide's own wireframe does: floor 2 gets
 * 201, 202, 203... A floor's own order is the hundreds digit, so the number
 * alone says which floor a room is on.
 *
 * Existing room numbers on the floor are skipped rather than collided with —
 * configuring a floor a second time (to add a few more rooms) must not try to
 * recreate "201" and fail with a conflict the owner did not cause.
 */
export function nextRoomNumbers(
  existingNumbers: string[],
  floorOrder: number,
  count: number,
): string[] {
  const used = new Set(existingNumbers)
  const prefix = String(Math.max(floorOrder, 1))
  const numbers: string[] = []
  let seq = 1
  while (numbers.length < count && seq < 1000) {
    const suffix = seq < 100 ? String(seq).padStart(2, '0') : String(seq)
    const candidate = `${prefix}${suffix}`
    if (!used.has(candidate)) numbers.push(candidate)
    seq++
  }
  return numbers
}

/**
 * Configure one floor without leaving the floors list.
 *
 * The flow: how many rooms? -> numbers generated for you -> fill in each
 * room's details -> add its beds. Asking for a count up front and generating
 * "201, 202, 203" is the same shortcut the guide already uses for beds ("ask
 * for a bed count, create Bed A, Bed B...") applied one level up, so a
 * ten-room floor costs one number entered rather than ten room numbers typed.
 *
 * Each room still commits to the server the moment its own details are saved,
 * not at the end — a floor with 3 of 6 rooms filled in is a real, keepable
 * state if the drawer is closed partway through.
 */
export function ConfigureFloorDrawer({
  open,
  onClose,
  onFloorConfigured,
  pgId,
  floorId,
  floorLabel,
  floorOrder,
  buildingName,
}: {
  open: boolean
  onClose: () => void
  onFloorConfigured: () => void
  pgId: string
  floorId: string
  floorLabel: string
  floorOrder: number
  buildingName?: string
}) {
  const { data: existingRooms = [] } = useListFloorRoomsQuery(
    { floorId, pgId },
    { skip: !open || !floorId },
  )
  const [createRoom, { isLoading: savingRoom, error: roomError }] = useCreateRoomMutation()
  const [generateBeds, { isLoading: savingBeds, error: bedError }] =
    useGenerateBedsMutation()

  const [stage, setStage] = useState<Stage>('count')
  const [roomCount, setRoomCount] = useState('1')
  const [queue, setQueue] = useState<string[]>([])
  const [configuredThisSession, setConfiguredThisSession] = useState(0)
  const [savedRoom, setSavedRoom] = useState<Room | null>(null)

  const [roomNumber, setRoomNumber] = useState('')
  const [roomType, setRoomType] = useState<RoomType>('double')
  const [totalBeds, setTotalBeds] = useState('2')
  const [rent, setRent] = useState('')
  const [description, setDescription] = useState('')

  const error = roomError ?? bedError
  const bedCount = Number(totalBeds) || 1
  const canSaveRoom = roomNumber.trim() !== '' && rent.trim() !== ''

  const parsedCount = Number(roomCount)
  const validCount = Number.isInteger(parsedCount) && parsedCount >= 1 && parsedCount <= 30
  const preview = validCount
    ? nextRoomNumbers(
        existingRooms.map((r) => r.room_number),
        floorOrder,
        parsedCount,
      )
    : []

  const resetAll = () => {
    setStage('count')
    setRoomCount('1')
    setQueue([])
    setConfiguredThisSession(0)
    setSavedRoom(null)
    setRoomNumber('')
    setDescription('')
  }

  const startQueue = () => {
    if (!validCount || preview.length === 0) return
    setQueue(preview)
    setRoomNumber(preview[0])
    setStage('room')
  }

  const saveRoom = async () => {
    if (!canSaveRoom) return
    const created = await createRoom({
      floorId,
      pgId,
      room_number: roomNumber.trim(),
      room_type: roomType,
      total_beds: bedCount,
      monthly_rent: rent,
      description: description.trim() || null,
      // Beds are the explicit next step here, so the room must not seed its
      // own — otherwise that step would find the room already full.
      generate_beds: false,
    })
      .unwrap()
      .catch(() => undefined)

    if (created) {
      setSavedRoom(created)
      setConfiguredThisSession((n) => n + 1)
      setStage('ask-beds')
    }
  }

  /** Move to the next queued room number, or the summary once none remain. */
  const advanceQueue = () => {
    const remaining = queue.slice(1)
    setQueue(remaining)
    setSavedRoom(null)
    if (remaining.length > 0) {
      setRoomNumber(remaining[0])
      setDescription('')
      setStage('room')
    } else {
      setStage('summary')
    }
  }

  const finish = () => {
    onFloorConfigured()
    resetAll()
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        resetAll()
        onClose()
      }}
      // Room configuration has the most going on of anything in a drawer —
      // two-column forms, a bed grid, a rooms preview — 'lg' left the details
      // step feeling cramped.
      width="xl"
      title={`Configure ${floorLabel}`}
      description={
        buildingName
          ? `${buildingName} · ${existingRooms.length} room(s) so far`
          : `${existingRooms.length} room(s) so far`
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <StageIndicator stage={stage} queue={queue} current={roomNumber} />
          <div className="flex gap-2">
            {stage === 'count' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetAll()
                    onClose()
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={startQueue} disabled={!validCount}>
                  Generate rooms
                </Button>
              </>
            ) : null}

            {stage === 'room' ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetAll()
                    onClose()
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveRoom} disabled={!canSaveRoom || savingRoom}>
                  {savingRoom ? 'Saving…' : 'Save room'}
                </Button>
              </>
            ) : null}

            {stage === 'ask-beds' ? (
              <>
                <Button variant="secondary" onClick={advanceQueue}>
                  Skip beds
                </Button>
                <Button onClick={() => setStage('beds')}>Add beds</Button>
              </>
            ) : null}

            {stage === 'beds' ? (
              <Button onClick={advanceQueue}>
                {queue.length > 1 ? 'Next room' : 'Finish floor'}
              </Button>
            ) : null}

            {stage === 'summary' ? (
              <>
                <Button variant="secondary" onClick={() => setStage('count')}>
                  Add more rooms
                </Button>
                <Button onClick={finish}>Done</Button>
              </>
            ) : null}
          </div>
        </div>
      }
    >
      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not save')}</ErrorNote>
        </div>
      ) : null}

      {stage === 'count' ? (
        <section>
          <StepHeading step={1} title="How many rooms on this floor?" />

          <div className="flex max-w-xs items-end gap-2">
            <Button
              type="button"
              variant="secondary"
              aria-label="Decrease room count"
              onClick={() => setRoomCount(String(Math.max(1, parsedCount - 1)))}
              disabled={!validCount || parsedCount <= 1}
            >
              −
            </Button>
            <div className="flex-1">
              <Field label="Number of rooms" required>
                <TextInput
                  autoFocus
                  className="text-center"
                  inputMode="numeric"
                  value={roomCount}
                  onChange={(event) => setRoomCount(event.target.value)}
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="secondary"
              aria-label="Increase room count"
              onClick={() => setRoomCount(String(Math.min(30, parsedCount + 1)))}
              disabled={!validCount || parsedCount >= 30}
            >
              +
            </Button>
          </div>

          {validCount ? (
            <p className="mt-3 text-sm text-slate-600">
              This will create room{preview.length === 1 ? '' : 's'}{' '}
              <span className="font-medium text-slate-900">
                {preview[0]}
                {preview.length > 1 ? `–${preview[preview.length - 1]}` : ''}
              </span>
              . You can rename any of them while filling in its details.
            </p>
          ) : null}

          {existingRooms.length > 0 ? <ExistingRooms rooms={existingRooms} /> : null}
        </section>
      ) : null}

      {stage === 'room' ? (
        <section>
          <StepHeading
            step={2}
            title={`Room ${roomNumber} details`}
            note={
              configuredThisSession + queue.length > 1
                ? `Room ${configuredThisSession + 1} of ${configuredThisSession + queue.length}`
                : undefined
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Room number" required hint="Auto-numbered — rename if you'd like.">
              <TextInput
                value={roomNumber}
                onChange={(event) => setRoomNumber(event.target.value)}
              />
            </Field>

            <Field label="Room type" required>
              <Select
                value={roomType}
                onChange={(event) => {
                  const next = event.target.value as RoomType
                  setRoomType(next)
                  const presetType = ROOM_TYPES.find((t) => t.value === next)
                  if (presetType && next !== 'sharing') setTotalBeds(String(presetType.beds))
                }}
              >
                {ROOM_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Total beds" required>
              <TextInput
                value={totalBeds}
                onChange={(event) => setTotalBeds(event.target.value)}
                inputMode="numeric"
              />
            </Field>

            <Field label="Monthly rent" required hint="Per bed. Beds inherit this.">
              <TextInput
                value={rent}
                onChange={(event) => setRent(event.target.value)}
                inputMode="decimal"
                placeholder="8000"
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <TextInput
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="AC, attached bathroom"
                />
              </Field>
            </div>
          </div>
        </section>
      ) : null}

      {stage === 'ask-beds' && savedRoom ? (
        <section className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
            ✓
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            Room {savedRoom.room_number} saved
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
            It is declared with {savedRoom.total_beds} bed(s) at{' '}
            {formatRupees(savedRoom.monthly_rent)} each. Add them now?
          </p>
        </section>
      ) : null}

      {stage === 'beds' && savedRoom ? (
        <section>
          <StepHeading step={3} title={`Beds for room ${savedRoom.room_number}`} />
          <BedsForRoom
            pgId={pgId}
            room={savedRoom}
            busy={savingBeds}
            onGenerate={() =>
              generateBeds({
                roomId: savedRoom.id,
                pgId,
                bed_count: savedRoom.total_beds,
                monthly_rent: savedRoom.monthly_rent,
              })
            }
          />
        </section>
      ) : null}

      {stage === 'summary' ? (
        <section className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
            ✓
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            {configuredThisSession} room{configuredThisSession === 1 ? '' : 's'} configured
          </h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
            {floorLabel} now has {existingRooms.length + configuredThisSession} room(s) in
            total. Add more, or you're done here.
          </p>
        </section>
      ) : null}
    </Drawer>
  )
}

function StepHeading({
  step,
  title,
  note,
}: {
  step: number
  title: string
  note?: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {step}
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
      {note ? <span className="text-xs text-slate-400">{note}</span> : null}
    </div>
  )
}

function StageIndicator({
  stage,
  queue,
  current,
}: {
  stage: Stage
  queue: string[]
  current: string
}) {
  const steps = ['Count', 'Rooms & beds', 'Done']
  const index = stage === 'count' ? 0 : stage === 'summary' ? 2 : 1

  return (
    <div className="flex items-center gap-1.5">
      {steps.map((label, i) => (
        <span key={label} className="flex items-center gap-1.5">
          <span
            className={[
              'h-1.5 w-6 rounded-full transition-colors',
              i <= index ? 'bg-brand-600' : 'bg-slate-200',
            ].join(' ')}
          />
          <span
            className={`text-xs ${i === index ? 'font-medium text-slate-700' : 'text-slate-400'}`}
          >
            {i === 1 && index === 1 && queue.length > 0 ? `Room ${current}` : label}
          </span>
        </span>
      ))}
    </div>
  )
}

function ExistingRooms({ rooms }: { rooms: Room[] }) {
  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Already on this floor
      </p>
      <div className="flex flex-wrap gap-2">
        {rooms.map((room) => (
          <span
            key={room.id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs"
          >
            <span className="font-medium text-slate-700">Room {room.room_number}</span>
            <span className="text-slate-400">
              {room.total_beds} bed{room.total_beds === 1 ? '' : 's'}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

function BedsForRoom({
  pgId,
  room,
  busy,
  onGenerate,
}: {
  pgId: string
  room: Room
  busy: boolean
  onGenerate: () => void
}) {
  const { data: beds = [] } = useListRoomBedsQuery({ roomId: room.id, pgId })
  const missing = Math.max(0, room.total_beds - beds.length)

  return (
    <>
      {missing > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
          <p className="text-sm text-slate-700">
            {missing} of {room.total_beds} bed(s) still to create.
          </p>
          <Button variant="secondary" onClick={onGenerate} disabled={busy}>
            {busy
              ? 'Creating…'
              : `Create Bed A–${String.fromCharCode(64 + room.total_beds)}`}
          </Button>
        </div>
      ) : (
        <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          All {room.total_beds} bed(s) created.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {beds.map((bed: Bed) => (
          <div
            key={bed.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          >
            <span>
              <span className="font-medium text-slate-800">{bed.bed_label}</span>
              <span className="block text-xs text-slate-500">
                {formatRupees(bed.monthly_rent)}/mo
              </span>
            </span>
            <Badge tone="amber">{bed.status}</Badge>
          </div>
        ))}
      </div>
    </>
  )
}
