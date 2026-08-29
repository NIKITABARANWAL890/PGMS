import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/renderWithProviders'

import OwnerLayout from './OwnerLayout'

const PG = {
  id: 'pg-1',
  name: 'Sunrise PG',
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
  total_beds: 0,
  occupied_beds: 0,
  vacant_beds: 0,
  maintenance_beds: 0,
}

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
      if (url === '/pgs') return json([PG])
      if (url === `/pgs/${PG.id}`) return json(PG)
      return json({ detail: 'not found' })
    }),
  )
}

/**
 * Only the routing shape under test — OwnerLayout deciding when its second
 * sidebar shows, driven purely by the URL via `useMatch`. This is the part
 * with no coverage anywhere else: every other test renders a workspace tab
 * directly, never through the layout that decides whether it gets a sidebar.
 */
function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route element={<OwnerLayout />}>
        <Route index element={<div>dashboard content</div>} />
        <Route path="/properties" element={<div>properties list</div>} />
        <Route path="/properties/new" element={<div>setup wizard</div>} />
        <Route path="/properties/:pgId" element={<div>workspace tab content</div>} />
        <Route path="/properties/:pgId/rooms" element={<div>rooms tab content</div>} />
        <Route
          path="/properties/:pgId/floors/:floorId"
          element={<div>floor detail content</div>}
        />
      </Route>
    </Routes>,
    { route: path },
  )
}

describe('OwnerLayout — workspace sidebar visibility', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows no property sidebar on the dashboard or properties list', async () => {
    stubServer()
    renderAt('/')
    expect(await screen.findByText('dashboard content')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Rooms$/ })).not.toBeInTheDocument()
  })

  it('shows no property sidebar on the setup wizard, even though the URL shape matches', async () => {
    // "/properties/new" matches the same :pgId pattern with pgId="new" — this
    // is exactly the case that must not fetch "new" as if it were a PG id.
    stubServer()
    renderAt('/properties/new')
    expect(await screen.findByText('setup wizard')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Details' })).not.toBeInTheDocument()
  })

  it('shows the property sidebar once inside a real PG workspace', async () => {
    stubServer()
    renderAt(`/properties/${PG.id}`)

    expect(await screen.findByText('workspace tab content')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Buildings & Floors/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Details$/ })).toBeInTheDocument()
    // The PG's name is not repeated here — it lives in exactly one place in
    // the workspace chrome, the PropertyBanner on the page itself.
    expect(screen.queryByRole('link', { name: /Sunrise PG/ })).not.toBeInTheDocument()
  })

  it('keeps the sidebar showing on a floor detail page, a sibling route', async () => {
    stubServer()
    renderAt(`/properties/${PG.id}/floors/f-1`)

    expect(await screen.findByText('floor detail content')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /^Rooms$/ })).toBeInTheDocument()
  })

  it("highlights Rooms in the sidebar while looking at one of its floors", async () => {
    stubServer()
    renderAt(`/properties/${PG.id}/floors/f-1`)

    const roomsLink = await screen.findByRole('link', { name: /^Rooms$/ })
    expect(roomsLink).toHaveAttribute('aria-current', 'page')
  })

  it('collapses the primary nav to icons inside a workspace, expanding only on hover', async () => {
    // Both navs stay on screen at once here — the primary nav never
    // disappears, it just shrinks to icons so it isn't as wide as the
    // workspace nav sitting next to it.
    stubServer()
    const user = userEvent.setup()
    renderAt(`/properties/${PG.id}`)
    // "workspace tab content" renders immediately (it is a hardcoded stand-in
    // route, not gated on the PG fetch) — wait for a secondary-sidebar link
    // instead, since that only exists once `pg` has actually loaded and the
    // primary nav has switched to its collapsible mode.
    await screen.findByRole('link', { name: /^Rooms$/ })

    // Its accessible name survives via aria-label regardless of collapse
    // state — only the visible text disappears. "Properties" (not
    // "Dashboard") is used because the workspace sub-nav has its own,
    // separate "Dashboard" tab with the same accessible name.
    const propertiesLink = screen.getByRole('link', { name: 'Properties' })
    expect(propertiesLink).not.toHaveTextContent('Properties')

    await user.hover(propertiesLink)
    expect(propertiesLink).toHaveTextContent('Properties')

    await user.unhover(propertiesLink)
    expect(propertiesLink).not.toHaveTextContent('Properties')
  })

  it('stays clickable while collapsed, without requiring a hover first', async () => {
    stubServer()
    renderAt(`/properties/${PG.id}`)
    await screen.findByRole('link', { name: /^Rooms$/ })

    const propertiesLink = screen.getByRole('link', { name: 'Properties' })
    expect(propertiesLink).toHaveAttribute('href', '/properties')
  })

  it('keeps the primary nav fully labeled outside a workspace', async () => {
    stubServer()
    renderAt('/')
    await screen.findByText('dashboard content')

    expect(screen.getByRole('link', { name: 'Properties' })).toHaveTextContent('Properties')
  })
})
