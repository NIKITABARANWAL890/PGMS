import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import LoginPage from './LoginPage'

describe('LoginPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the sign-in form', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('validates before calling the API', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const user = userEvent.setup()

    renderWithProviders(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
    // A form that fails its own validation must not reach the network.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('stores the access token in Redux and the refresh token in localStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            access_token: 'access-abc',
            refresh_token: 'refresh-xyz',
            token_type: 'bearer',
            expires_in: 900,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const user = userEvent.setup()
    const { store } = renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com')
    await user.type(screen.getByLabelText(/password/i), 'OwnerPass123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(store.getState().auth.accessToken).toBe('access-abc')
    })

    // The access token is the credential that opens the API, so it must never
    // be written to persistent storage — only the refresh token is.
    expect(window.localStorage.getItem('pgms.refresh_token')).toBe('refresh-xyz')
    expect(window.localStorage.getItem('pgms.access_token')).toBeNull()
    expect(JSON.stringify(window.localStorage)).not.toContain('access-abc')
  })

  it('shows the API error message when sign-in is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: 'Incorrect email or password' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email/i), 'owner@example.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect email or password/i)
  })
})
