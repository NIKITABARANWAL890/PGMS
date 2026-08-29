import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import PGSetupPage from './PGSetupPage'

const PG = {
  id: 'pg-1',
  name: 'Sunrise PG',
  address: '24th Main, Koramangala',
  pg_type: 'boys',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560034',
  contact_phone: '9876543210',
  contact_email: null,
  pg_code: 'SPG001',
  description: null,
  created_at: '2026-08-25T00:00:00Z',
  total_beds: 0,
  occupied_beds: 0,
  vacant_beds: 0,
  maintenance_beds: 0,
}

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

function stubServer(posts: Post[], overrides: Record<string, unknown> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const url = new URL(request.url).pathname

      if (request.method === 'GET') {
        if (url in overrides) return json(overrides[url])
        if (url.endsWith('/buildings')) return json([])
        if (url.endsWith('/floors')) return json([])
        if (url.endsWith('/floor-overview')) return json([])
        if (url.endsWith('/rooms')) return json([])
        if (url.endsWith('/beds')) return json([])
        return json([])
      }

      if (request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
        posts.push({ url, body })
        if (url === '/pgs') return json(PG, 201)
        if (url.endsWith('/buildings')) {
          return json({ id: 'b-1', pg_id: PG.id, name: body.name, building_code: null }, 201)
        }
        if (url.endsWith('/floors/generate')) {
          const count = Number(body.floor_count)
          return json(
            Array.from({ length: count }, (_, i) => ({
              id: `f-${i + 1}`,
              building_id: 'b-1',
              floor_label: `Floor ${i + 1}`,
              floor_order: i + 1,
            })),
            201,
          )
        }
      }
      return json({ detail: 'not found' }, 404)
    }),
  )
}

describe('PG setup wizard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('collects every field the guide marks required before creating the PG', async () => {
    const posts: Post[] = []
    stubServer(posts)
    const user = userEvent.setup()
    renderWithProviders(<PGSetupPage />)

    await user.type(screen.getByLabelText(/PG name/i), 'Sunrise PG')
    await user.selectOptions(screen.getByLabelText(/PG type/i), 'boys')
    await user.type(screen.getByLabelText(/Address/i), '24th Main, Koramangala')
    await user.type(screen.getByLabelText(/City/i), 'Bengaluru')
    await user.type(screen.getByLabelText(/State/i), 'Karnataka')
    await user.type(screen.getByLabelText(/Pincode/i), '560034')
    await user.type(screen.getByLabelText(/Contact phone/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /save & next/i }))

    await waitFor(() => expect(posts.some((p) => p.url === '/pgs')).toBe(true))
    expect(posts.find((p) => p.url === '/pgs')!.body).toMatchObject({
      name: 'Sunrise PG',
      pg_type: 'boys',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
      contact_phone: '9876543210',
    })
  })

  it('blocks the PG step until the required fields are filled', async () => {
    const posts: Post[] = []
    stubServer(posts)
    const user = userEvent.setup()
    renderWithProviders(<PGSetupPage />)

    await user.type(screen.getByLabelText(/PG name/i), 'Sunrise PG')
    await user.click(screen.getByRole('button', { name: /save & next/i }))

    expect(await screen.findByText(/City is required/i)).toBeInTheDocument()
    expect(posts.some((p) => p.url === '/pgs')).toBe(false)
  })

  it('creates Main Building automatically for a single-building PG', async () => {
    const posts: Post[] = []
    stubServer(posts)
    const user = userEvent.setup()
    renderWithProviders(<PGSetupPage />)

    // Step 1
    await user.type(screen.getByLabelText(/PG name/i), 'Sunrise PG')
    await user.type(screen.getByLabelText(/Address/i), '24th Main')
    await user.type(screen.getByLabelText(/City/i), 'Bengaluru')
    await user.type(screen.getByLabelText(/State/i), 'Karnataka')
    await user.type(screen.getByLabelText(/Pincode/i), '560034')
    await user.type(screen.getByLabelText(/Contact phone/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /save & next/i }))

    // Step 2 — Single is the default, so this is one click.
    const next = await screen.findByRole('button', { name: /save & next/i })
    expect(screen.getByText(/Main Building/)).toBeInTheDocument()
    await user.click(next)

    await waitFor(() => {
      expect(posts.some((p) => p.url === `/pgs/${PG.id}/buildings`)).toBe(true)
    })
    expect(posts.find((p) => p.url.endsWith('/buildings'))!.body).toMatchObject({
      name: 'Main Building',
    })
  })

  it('generates Floor 1..N from a count rather than one at a time', async () => {
    const posts: Post[] = []
    stubServer(posts)
    const user = userEvent.setup()
    renderWithProviders(<PGSetupPage />)

    await user.type(screen.getByLabelText(/PG name/i), 'Sunrise PG')
    await user.type(screen.getByLabelText(/Address/i), '24th Main')
    await user.type(screen.getByLabelText(/City/i), 'Bengaluru')
    await user.type(screen.getByLabelText(/State/i), 'Karnataka')
    await user.type(screen.getByLabelText(/Pincode/i), '560034')
    await user.type(screen.getByLabelText(/Contact phone/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /save & next/i }))

    await user.click(await screen.findByRole('button', { name: /save & next/i }))

    // Step 3 — floor count.
    const countField = await screen.findByLabelText(/Number of floors/i)
    await user.clear(countField)
    await user.type(countField, '4')
    expect(screen.getByText(/Floor 1 to Floor 4/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /generate floors/i }))

    await waitFor(() => {
      expect(posts.some((p) => p.url.endsWith('/floors/generate'))).toBe(true)
    })
    expect(posts.find((p) => p.url.endsWith('/floors/generate'))!.body).toMatchObject({
      floor_count: 4,
    })
  })

  it('marks floors with no rooms as Not configured', async () => {
    const posts: Post[] = []
    stubServer(posts, {
      [`/pgs/${PG.id}/floor-overview`]: [
        {
          id: 'f-1',
          building_id: 'b-1',
          floor_label: 'Floor 1',
          floor_order: 1,
          room_count: 0,
          bed_count: 0,
          occupied_beds: 0,
          monthly_rent_total: '0',
        },
        {
          id: 'f-2',
          building_id: 'b-1',
          floor_label: 'Floor 2',
          floor_order: 2,
          room_count: 6,
          bed_count: 18,
          occupied_beds: 4,
          monthly_rent_total: '144000',
        },
      ],
      [`/pgs/${PG.id}/buildings`]: [
        { id: 'b-1', pg_id: PG.id, name: 'Main Building', building_code: null },
      ],
    })
    const user = userEvent.setup()
    renderWithProviders(<PGSetupPage />)

    await user.type(screen.getByLabelText(/PG name/i), 'Sunrise PG')
    await user.type(screen.getByLabelText(/Address/i), '24th Main')
    await user.type(screen.getByLabelText(/City/i), 'Bengaluru')
    await user.type(screen.getByLabelText(/State/i), 'Karnataka')
    await user.type(screen.getByLabelText(/Pincode/i), '560034')
    await user.type(screen.getByLabelText(/Contact phone/i), '9876543210')
    await user.click(screen.getByRole('button', { name: /save & next/i }))
    await user.click(await screen.findByRole('button', { name: /save & next/i }))
    await user.click(await screen.findByRole('button', { name: /generate floors/i }))

    // Floors Overview: status is read from room_count, never stored.
    const floorOne = await screen.findByRole('article', { name: /Floor 1/ })
    const floorTwo = screen.getByRole('article', { name: /Floor 2/ })

    expect(within(floorOne).getByText(/Not configured/i)).toBeInTheDocument()
    expect(within(floorTwo).getByText(/^Configured$/i)).toBeInTheDocument()
    expect(within(floorTwo).getByText('6')).toBeInTheDocument()
  })
})
