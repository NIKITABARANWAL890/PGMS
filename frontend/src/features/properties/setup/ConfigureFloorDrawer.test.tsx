import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { ConfigureFloorDrawer, nextRoomNumbers } from './ConfigureFloorDrawer'

const PG_ID = 'pg-1'
const FLOOR_ID = 'f-1'
const FLOOR_ORDER = 2

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface Post {
  url: string
  body: Record<string, unknown>
}

interface StubRoom {
  id: string
  floor_id: string
  room_number: unknown
  room_type: unknown
  total_beds: unknown
  monthly_rent: unknown
  description: unknown
}

/** A fake server whose room/bed endpoints actually persist across calls. */
function stubServer(posts: Post[], seedRooms: { room_number: string }[] = []) {
  const rooms = new Map<string, StubRoom>(
    seedRooms.map((r, i) => [
      `seed-${i}`,
      {
        id: `seed-${i}`,
        floor_id: FLOOR_ID,
        room_number: r.room_number,
        room_type: 'double',
        total_beds: 2,
        monthly_rent: '8000.00',
        description: null,
      },
    ]),
  )
  const beds = new Map<string, unknown[]>()
  let nextRoomId = 0
  let nextBedId = 0

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const url = new URL(request.url).pathname

      if (request.method === 'GET') {
        if (url === `/floors/${FLOOR_ID}/rooms`) return json([...rooms.values()])
        const bedsMatch = url.match(/^\/rooms\/([^/]+)\/beds$/)
        if (bedsMatch) return json(beds.get(bedsMatch[1]) ?? [])
        return json([])
      }

      if (request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        posts.push({ url, body })

        if (url === `/floors/${FLOOR_ID}/rooms`) {
          const id = `room-${nextRoomId++}`
          const room = {
            id,
            floor_id: FLOOR_ID,
            room_number: body.room_number,
            room_type: body.room_type,
            total_beds: body.total_beds,
            monthly_rent: body.monthly_rent,
            description: body.description ?? null,
          }
          rooms.set(id, room)
          beds.set(id, [])
          return json(room, 201)
        }

        const genMatch = url.match(/^\/rooms\/([^/]+)\/beds\/generate$/)
        if (genMatch) {
          const roomId = genMatch[1]
          const room = rooms.get(roomId) as { total_beds: number; monthly_rent: string }
          const labels = ['Bed A', 'Bed B', 'Bed C', 'Bed D'].slice(0, room.total_beds)
          const generated = labels.map((label) => ({
            id: `bed-${nextBedId++}`,
            room_id: roomId,
            bed_label: label,
            status: 'vacant',
            monthly_rent: room.monthly_rent,
          }))
          beds.set(roomId, generated)
          return json(generated, 201)
        }
      }
      return json({ detail: 'not found' }, 404)
    }),
  )
}

function renderDrawer(overrides: Partial<Parameters<typeof ConfigureFloorDrawer>[0]> = {}) {
  return renderWithProviders(
    <ConfigureFloorDrawer
      open
      pgId={PG_ID}
      floorId={FLOOR_ID}
      floorLabel="Floor 2"
      floorOrder={FLOOR_ORDER}
      buildingName="Main Building"
      onClose={() => {}}
      onFloorConfigured={() => {}}
      {...overrides}
    />,
  )
}

describe('nextRoomNumbers', () => {
  it('numbers rooms with the floor order as the hundreds digit', () => {
    expect(nextRoomNumbers([], 2, 3)).toEqual(['201', '202', '203'])
    expect(nextRoomNumbers([], 1, 2)).toEqual(['101', '102'])
  })

  it('skips numbers already used on the floor', () => {
    expect(nextRoomNumbers(['201', '203'], 2, 2)).toEqual(['202', '204'])
  })

  it('floors floor_order at 1, so a legacy zero-order floor still gets sane numbers', () => {
    expect(nextRoomNumbers([], 0, 2)).toEqual(['101', '102'])
  })
})

describe('ConfigureFloorDrawer', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens asking how many rooms, not a room form', async () => {
    stubServer([])
    renderDrawer()

    expect(await screen.findByText(/how many rooms/i)).toBeInTheDocument()
    expect(screen.queryByText(/room details/i)).not.toBeInTheDocument()
  })

  it('previews the auto-generated numbers before creating anything', async () => {
    stubServer([])
    const user = userEvent.setup()
    renderDrawer()

    const countField = await screen.findByLabelText(/number of rooms/i)
    await user.clear(countField)
    await user.type(countField, '3')

    // Floor order 2 -> 201, 202, 203 (matches the guide's own numbering).
    expect(await screen.findByText(/201–203/)).toBeInTheDocument()
  })

  it('skips numbers already on the floor when previewing and creating', async () => {
    const posts: Post[] = []
    stubServer(posts, [{ room_number: '201' }])
    const user = userEvent.setup()
    renderDrawer()

    const countField = await screen.findByLabelText(/number of rooms/i)
    await user.clear(countField)
    await user.type(countField, '1')
    // The number itself is its own span, sibling to the "This will create
    // room" text -- match the span's own content rather than text split
    // across the two nodes.
    expect(await screen.findByText('202')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /generate rooms/i }))
    expect(await screen.findByDisplayValue('202')).toBeInTheDocument()
  })

  it('walks through every generated room, saving each and offering beds', async () => {
    const posts: Post[] = []
    stubServer(posts)
    const user = userEvent.setup()
    renderDrawer()

    const countField = await screen.findByLabelText(/number of rooms/i)
    await user.clear(countField)
    await user.type(countField, '2')
    await user.click(screen.getByRole('button', { name: /generate rooms/i }))

    // Room 1 of 2: the number is pre-filled, only rent is required.
    expect(await screen.findByDisplayValue('201')).toBeInTheDocument()
    expect(screen.getByText(/room 1 of 2/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/monthly rent/i), '8000')
    await user.click(screen.getByRole('button', { name: /save room/i }))

    await waitFor(() => {
      expect(posts.some((p) => p.body.room_number === '201')).toBe(true)
    })
    expect(posts.find((p) => p.body.room_number === '201')!.body).toMatchObject({
      generate_beds: false,
    })
    expect(await screen.findByText(/room 201 saved/i)).toBeInTheDocument()

    // Skip beds on room 1, land straight on room 2 -- no manual re-entry.
    await user.click(screen.getByRole('button', { name: /skip beds/i }))
    expect(await screen.findByDisplayValue('202')).toBeInTheDocument()
    expect(screen.getByText(/room 2 of 2/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/monthly rent/i), '8500')
    await user.click(screen.getByRole('button', { name: /save room/i }))
    await user.click(await screen.findByRole('button', { name: /^add beds$/i }))

    expect(await screen.findByText(/beds for room 202/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /create bed a–b/i }))
    await waitFor(() => {
      expect(posts.some((p) => p.url === '/rooms/room-1/beds/generate')).toBe(true)
    })

    // Last room in the queue -> "Finish floor", landing on the summary.
    await user.click(screen.getByRole('button', { name: /finish floor/i }))
    expect(await screen.findByText(/2 rooms configured/i)).toBeInTheDocument()
  })

  it('lets the owner rename an auto-generated room number', async () => {
    const posts: Post[] = []
    stubServer(posts)
    const user = userEvent.setup()
    renderDrawer()

    await user.clear(await screen.findByLabelText(/number of rooms/i))
    await user.type(screen.getByLabelText(/number of rooms/i), '1')
    await user.click(screen.getByRole('button', { name: /generate rooms/i }))

    const numberField = await screen.findByDisplayValue('201')
    await user.clear(numberField)
    await user.type(numberField, '201-A')
    await user.type(screen.getByLabelText(/monthly rent/i), '8000')
    await user.click(screen.getByRole('button', { name: /save room/i }))

    await waitFor(() => {
      expect(posts.some((p) => p.body.room_number === '201-A')).toBe(true)
    })
  })

  it('offers "Add more rooms" from the summary, returning to the count step', async () => {
    stubServer([])
    const user = userEvent.setup()
    renderDrawer()

    await user.clear(await screen.findByLabelText(/number of rooms/i))
    await user.type(screen.getByLabelText(/number of rooms/i), '1')
    await user.click(screen.getByRole('button', { name: /generate rooms/i }))
    await user.type(screen.getByLabelText(/monthly rent/i), '8000')
    await user.click(screen.getByRole('button', { name: /save room/i }))
    await user.click(await screen.findByRole('button', { name: /skip beds/i }))

    expect(await screen.findByText(/1 room configured/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add more rooms/i }))

    expect(await screen.findByText(/how many rooms/i)).toBeInTheDocument()
  })

  it('finishes and closes only from the summary\'s Done button', async () => {
    stubServer([])
    const onClose = vi.fn()
    const onFloorConfigured = vi.fn()
    const user = userEvent.setup()
    renderDrawer({ onClose, onFloorConfigured })

    await user.clear(await screen.findByLabelText(/number of rooms/i))
    await user.type(screen.getByLabelText(/number of rooms/i), '1')
    await user.click(screen.getByRole('button', { name: /generate rooms/i }))
    await user.type(screen.getByLabelText(/monthly rent/i), '8000')
    await user.click(screen.getByRole('button', { name: /save room/i }))
    await user.click(await screen.findByRole('button', { name: /skip beds/i }))

    expect(onFloorConfigured).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: /^done$/i }))

    expect(onFloorConfigured).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    stubServer([])
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDrawer({ onClose })

    await screen.findByText(/how many rooms/i)
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })
})
