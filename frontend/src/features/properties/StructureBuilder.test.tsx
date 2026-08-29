import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { StructureBuilder } from './StructureBuilder'

const PG_ID = 'pg-1'

const BUILDINGS = [{ id: 'b-1', pg_id: PG_ID, name: 'White rose' }]

const FLOORS = [
  {
    id: 'f-1',
    building_id: 'b-1',
    floor_label: '1st Floor',
    floor_order: 1,
    building_name: 'White rose',
    room_count: 1,
  },
  {
    id: 'f-2',
    building_id: 'b-1',
    floor_label: '2nd Floor',
    floor_order: 2,
    building_name: 'White rose',
    room_count: 0,
  },
]

const ROOMS = {
  pg_id: PG_ID,
  pg_name: 'White rose girls pg',
  total_beds: 1,
  occupied_beds: 0,
  vacant_beds: 1,
  maintenance_beds: 0,
  rooms: [
    {
      id: 'r-1',
      floor_id: 'f-1',
      room_number: '101',
      room_type: 'double',
      total_beds: 2,
      floor_label: '1st Floor',
      building_name: 'White rose',
      beds: [
        { id: 'bed-1', room_id: 'r-1', bed_label: 'Bed A', status: 'vacant', monthly_rent: '8000.00' },
      ],
      occupied_beds: 0,
      vacant_beds: 1,
      maintenance_beds: 0,
    },
  ],
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Serve the existing structure as if it had been created in an earlier session. */
function stubServer(onPost?: (url: string, body: unknown) => void) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const url = new URL(request.url).pathname

      if (request.method === 'GET') {
        if (url === `/pgs/${PG_ID}/buildings`) return json(BUILDINGS)
        if (url === `/pgs/${PG_ID}/floors`) return json(FLOORS)
        if (url === `/pgs/${PG_ID}/rooms`) return json(ROOMS)
      }
      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}))
        onPost?.(url, body)
        if (url.endsWith('/beds')) {
          return json({ id: 'bed-2', room_id: 'r-1', bed_label: 'Bed B', status: 'vacant', monthly_rent: '7500.00' }, 201)
        }
        if (url.endsWith('/rooms')) {
          return json({ id: 'r-2', floor_id: 'f-2', room_number: '201', room_type: 'single', total_beds: 1 }, 201)
        }
        if (url.endsWith('/floors')) {
          return json({ id: 'f-3', building_id: 'b-1', floor_label: '3rd Floor', floor_order: 3 }, 201)
        }
        if (url.endsWith('/buildings')) return json({ id: 'b-2', pg_id: PG_ID, name: 'Annexe' }, 201)
      }
      return json({ detail: 'not found' }, 404)
    }),
  )
}

describe('StructureBuilder', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('offers floors loaded from the server, not just ones created this session', async () => {
    // The regression this guards: floors used to be remembered in component
    // state, so a page reload emptied the picker and rooms could not be added
    // to floors that were already saved.
    stubServer()
    renderWithProviders(<StructureBuilder pgId={PG_ID} />)

    const floorSelect = await screen.findByLabelText('Floor')
    await waitFor(() => {
      expect(within(floorSelect).getAllByRole('option').length).toBe(FLOORS.length + 1)
    })

    expect(within(floorSelect).getByText('White rose · 1st Floor')).toBeInTheDocument()
    expect(within(floorSelect).getByText('White rose · 2nd Floor')).toBeInTheDocument()
  })

  it('offers buildings and rooms loaded from the server too', async () => {
    stubServer()
    renderWithProviders(<StructureBuilder pgId={PG_ID} />)

    const buildingSelect = await screen.findByLabelText('Building')
    await waitFor(() => {
      expect(within(buildingSelect).getByText('White rose')).toBeInTheDocument()
    })

    const roomSelect = await screen.findByLabelText('Room')
    await waitFor(() => {
      // Shows how full each room already is, so capacity is visible up front.
      expect(within(roomSelect).getByText('Room 101 (1/2)')).toBeInTheDocument()
    })
  })

  it('adds a bed to an existing room', async () => {
    const posts: { url: string; body: unknown }[] = []
    stubServer((url, body) => posts.push({ url, body }))

    const user = userEvent.setup()
    renderWithProviders(<StructureBuilder pgId={PG_ID} />)

    const roomSelect = await screen.findByLabelText('Room')
    await waitFor(() => expect(within(roomSelect).getAllByRole('option').length).toBe(2))

    await user.selectOptions(roomSelect, 'r-1')
    await user.type(screen.getByLabelText('Bed label'), 'Bed B')
    await user.type(screen.getByLabelText('Bed rent'), '7500')
    await user.click(screen.getByRole('button', { name: /add bed/i }))

    await waitFor(() => {
      expect(posts.some((p) => p.url === '/rooms/r-1/beds')).toBe(true)
    })
    const bedPost = posts.find((p) => p.url === '/rooms/r-1/beds')!
    expect(bedPost.body).toMatchObject({ bed_label: 'Bed B', monthly_rent: '7500' })
  })

  it('will not let a room exceed its declared bed capacity', async () => {
    // Room 101 declares 2 beds and already has 1, so filling it must close the
    // form rather than let the server reject the third bed.
    const fullRooms = {
      ...ROOMS,
      rooms: [
        {
          ...ROOMS.rooms[0],
          beds: [
            ROOMS.rooms[0].beds[0],
            { id: 'bed-2', room_id: 'r-1', bed_label: 'Bed B', status: 'vacant', monthly_rent: null },
          ],
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init)
        const url = new URL(request.url).pathname
        if (url === `/pgs/${PG_ID}/buildings`) return json(BUILDINGS)
        if (url === `/pgs/${PG_ID}/floors`) return json(FLOORS)
        if (url === `/pgs/${PG_ID}/rooms`) return json(fullRooms)
        return json({}, 404)
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<StructureBuilder pgId={PG_ID} />)

    const roomSelect = await screen.findByLabelText('Room')
    await waitFor(() => expect(within(roomSelect).getAllByRole('option').length).toBe(2))
    await user.selectOptions(roomSelect, 'r-1')

    expect(await screen.findByText(/already has all 2 of its declared beds/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add bed/i })).toBeDisabled()
  })
})
