import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import { AddStaffForm } from './AddStaffForm'

const PGS = [
  { id: 'pg-1', name: 'Sunrise PG', address: 'Koramangala', total_beds: 10, occupied_beds: 8, vacant_beds: 2, maintenance_beds: 0 },
  { id: 'pg-2', name: 'Green Stay', address: 'HSR Layout', total_beds: 6, occupied_beds: 3, vacant_beds: 3, maintenance_beds: 0 },
]

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('AddStaffForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('walks Basic Info -> Assign PG(s) -> Review & Add, and submits once at the end', async () => {
    const calls: { url: string; body: unknown }[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init)
        const url = request.url

        if (url.endsWith('/pgs')) {
          if (request.method === 'GET') return jsonResponse(PGS)
        }
        if (url.endsWith('/staff') && request.method === 'POST') {
          const body = await request.json()
          calls.push({ url, body })
          return jsonResponse(
            {
              id: 'staff-1',
              full_name: body.full_name,
              email: body.email,
              phone: body.phone,
              staff_title: body.staff_title,
              is_active: true,
              assigned_pgs: PGS.filter((pg) => body.pg_ids.includes(pg.id)),
              temporary_password: 'Temp1234abcd',
            },
            201,
          )
        }
        return jsonResponse({ detail: 'unexpected' }, 404)
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<AddStaffForm onDone={() => {}} />)

    // --- Step 1: Basic Information
    await user.type(screen.getByLabelText(/full name/i), 'Suresh Singh')
    await user.type(screen.getByLabelText(/phone number/i), '9876543210')
    await user.type(screen.getByLabelText(/email/i), 'suresh@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))

    // --- Step 2: Assign PG(s)
    const sunrise = await screen.findByLabelText(/sunrise pg/i)
    await user.click(sunrise)
    await user.click(screen.getByRole('button', { name: /next/i }))

    // --- Step 3: Review & Add
    expect(await screen.findByText(/staff information/i)).toBeInTheDocument()
    expect(screen.getByText('Suresh Singh')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add staff/i }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body).toMatchObject({
      full_name: 'Suresh Singh',
      email: 'suresh@example.com',
      pg_ids: ['pg-1'],
    })

    // The temporary password is shown once, because staff never set their own.
    expect(await screen.findByText('Temp1234abcd')).toBeInTheDocument()
  })

  it('never sends a permissions payload — staff capability is fixed', async () => {
    const bodies: Record<string, unknown>[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init)
        if (request.url.endsWith('/pgs') && request.method === 'GET') return jsonResponse(PGS)
        if (request.url.endsWith('/staff') && request.method === 'POST') {
          const body = await request.json()
          bodies.push(body)
          return jsonResponse(
            {
              id: 'staff-1',
              full_name: body.full_name,
              email: body.email,
              phone: body.phone,
              staff_title: body.staff_title,
              is_active: true,
              assigned_pgs: [],
              temporary_password: 'Temp1234abcd',
            },
            201,
          )
        }
        return jsonResponse({}, 404)
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<AddStaffForm onDone={() => {}} />)

    await user.type(screen.getByLabelText(/full name/i), 'Suresh Singh')
    await user.type(screen.getByLabelText(/phone number/i), '9876543210')
    await user.type(screen.getByLabelText(/email/i), 'suresh@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(await screen.findByLabelText(/sunrise pg/i))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /add staff/i }))

    await waitFor(() => expect(bodies).toHaveLength(1))
    const sent = Object.keys(bodies[0])
    expect(sent).toEqual(
      expect.arrayContaining(['full_name', 'phone', 'email', 'staff_title', 'pg_ids']),
    )
    // The decision this locks in: PG assignment varies, capability does not.
    expect(sent).not.toContain('permissions')
    expect(sent).not.toContain('permission_flags')
  })

  it('will not advance past step 1 with an invalid phone number', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(PGS)))
    const user = userEvent.setup()
    renderWithProviders(<AddStaffForm onDone={() => {}} />)

    await user.type(screen.getByLabelText(/full name/i), 'Suresh Singh')
    await user.type(screen.getByLabelText(/phone number/i), '12')
    await user.type(screen.getByLabelText(/email/i), 'suresh@example.com')
    await user.click(screen.getByRole('button', { name: /next/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/10-digit phone number/i)
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })
})
