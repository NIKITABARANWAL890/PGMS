import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import PropertiesPage from './PropertiesPage'

function pg(id: string, name: string) {
  return {
    id,
    name,
    address: '24th Main',
    pg_type: 'co_living',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
    contact_phone: '9876543210',
    contact_email: null,
    pg_code: null,
    description: null,
    created_at: '2026-08-25T00:00:00Z',
    total_beds: 4,
    occupied_beds: 1,
    vacant_beds: 3,
    maintenance_beds: 0,
  }
}

const PGS = [pg('pg-1', 'Sunrise PG'), pg('pg-2', 'Green Stay')]

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubServer() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input).pathname
      if (url === '/pgs') return json(PGS)
      return json({ detail: 'not found' })
    }),
  )
}

/**
 * The "Viewing" filter is a hand-built listbox, not a native <select> — the
 * earlier native-select-under-a-styled-pill version left every option's
 * padding entirely up to the browser, which on Windows rendered visibly
 * cramped. These tests exercise the real interaction, not just markup.
 */
describe('PropertiesPage — Viewing filter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows every property before any filter is applied', async () => {
    stubServer()
    renderWithProviders(<PropertiesPage />)

    expect(await screen.findByText('Sunrise PG')).toBeInTheDocument()
    expect(screen.getByText('Green Stay')).toBeInTheDocument()
  })

  it('opens a real listbox, not a native select, with both PGs listed', async () => {
    stubServer()
    const user = userEvent.setup()
    renderWithProviders(<PropertiesPage />)
    await screen.findByText('Sunrise PG')

    await user.click(screen.getByRole('button', { name: /viewing/i }))

    const listbox = screen.getByRole('listbox', { name: /filter properties/i })
    expect(within(listbox).getByRole('option', { name: 'All PGs' })).toBeInTheDocument()
    expect(within(listbox).getByRole('option', { name: 'Sunrise PG' })).toBeInTheDocument()
    expect(within(listbox).getByRole('option', { name: 'Green Stay' })).toBeInTheDocument()
  })

  it('filters the grid down to the selected property', async () => {
    stubServer()
    const user = userEvent.setup()
    renderWithProviders(<PropertiesPage />)
    await screen.findByText('Sunrise PG')

    await user.click(screen.getByRole('button', { name: /viewing/i }))
    await user.click(screen.getByRole('option', { name: 'Sunrise PG' }))

    // "Sunrise PG" now appears twice (the filter trigger's own label, and the
    // card) -- the card title is a button whose accessible name is exactly
    // the PG name, unlike the trigger's ("Viewing Sunrise PG").
    expect(screen.getByRole('button', { name: 'Sunrise PG' })).toBeInTheDocument()
    expect(screen.queryByText('Green Stay')).not.toBeInTheDocument()
    // The trigger reflects the current selection.
    expect(screen.getByRole('button', { name: /viewing/i })).toHaveTextContent('Sunrise PG')
  })

  it('returns to showing everything via "All PGs"', async () => {
    stubServer()
    const user = userEvent.setup()
    renderWithProviders(<PropertiesPage />)
    await screen.findByText('Sunrise PG')

    await user.click(screen.getByRole('button', { name: /viewing/i }))
    await user.click(screen.getByRole('option', { name: 'Sunrise PG' }))
    expect(screen.queryByText('Green Stay')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /viewing/i }))
    await user.click(screen.getByRole('option', { name: 'All PGs' }))

    expect(screen.getByText('Sunrise PG')).toBeInTheDocument()
    expect(screen.getByText('Green Stay')).toBeInTheDocument()
  })

  it('closes on Escape without changing the selection', async () => {
    stubServer()
    const user = userEvent.setup()
    renderWithProviders(<PropertiesPage />)
    await screen.findByText('Sunrise PG')

    await user.click(screen.getByRole('button', { name: /viewing/i }))
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Green Stay')).toBeInTheDocument()
  })
})
