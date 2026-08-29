import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useLogoutMutation } from '@/features/auth/authApi'
import { useAvatar } from '@/hooks/useAvatar'
import { useAppSelector } from '@/hooks/redux'

import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { IconChevronDown, IconLogOut, IconUser } from './icons'

export interface NavItem {
  label: string
  to: string
  icon?: ReactNode
  /** Phase 2-6 screens are listed but not reachable yet — see NavLink below. */
  comingSoon?: boolean
}

/**
 * The two-sidebar shell: a top bar spanning the full width, a primary sidebar
 * below it for the whole app, and an optional secondary one for whatever is
 * scoped to the current page (a property's own workspace nav).
 *
 * Both stay visible together — the primary nav never disappears entirely, it
 * just collapses to an icon-only rail once a secondary sidebar is showing, so
 * two full labeled columns don't eat a third of the screen before any content
 * starts. Hovering it expands back to full width as a floating panel that
 * overlaps the workspace nav rather than pushing it sideways; leaving that
 * hover area collapses it again. The collapsed rail stays clickable the whole
 * time — reaching for "Properties" or "Staff" from inside a workspace never
 * requires hovering first, just clicking the icon you already recognize.
 */
export function AppShell({
  brand,
  navItems,
  secondaryNav,
  children,
}: {
  brand: string
  navItems: NavItem[]
  secondaryNav?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col">
      <TopNavbar brand={brand} />

      <div className="relative flex min-h-0 flex-1">
        <PrimarySidebar navItems={navItems} collapsible={Boolean(secondaryNav)} />

        {secondaryNav}

        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-20 py-7">
          {children}
        </main>
      </div>
    </div>
  )
}

function PrimarySidebar({
  navItems,
  collapsible,
}: {
  navItems: NavItem[]
  collapsible: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const showLabels = !collapsible || expanded

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3 py-4">
      {navItems.map((item) =>
        item.comingSoon ? (
          <span
            key={item.label}
            title={item.label}
            className={[
              'flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500',
              showLabels ? 'justify-between' : 'justify-center',
            ].join(' ')}
          >
            <span className="flex items-center gap-2.5 text-slate-600 [&>svg]:h-4.5 [&>svg]:w-4.5">
              {item.icon}
              {showLabels ? item.label : null}
            </span>
            {showLabels ? (
              <span className="text-[10px] tracking-wide uppercase">soon</span>
            ) : null}
          </span>
        ) : (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.to === '/'}
            // The visible label can disappear while collapsed; the accessible
            // name must not — aria-label wins regardless of whether the text
            // node beside it is actually rendered.
            aria-label={item.label}
            title={showLabels ? undefined : item.label}
            className={({ isActive }) =>
              [
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                showLabels ? '' : 'justify-center',
                isActive
                  ? 'bg-linear-to-r from-brand-600 to-brand-500 font-medium text-white shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              ].join(' ')
            }
          >
            <span className="shrink-0 opacity-90 [&>svg]:h-4.5 [&>svg]:w-4.5">
              {item.icon}
            </span>
            {showLabels ? item.label : null}
          </NavLink>
        ),
      )}
    </nav>
  )

  if (!collapsible) {
    return (
      <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto bg-linear-to-b from-navy-900 to-navy-800 text-slate-200 md:flex">
        {nav}
      </aside>
    )
  }

  return (
    <>
      {/* Reserves the collapsed rail's width in the flex layout at all times,
          so nothing else on screen shifts when the real sidebar (below, an
          absolutely-positioned sibling) grows past it on hover. */}
      <div aria-hidden className="hidden w-16 shrink-0 md:block" />
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={[
          'absolute inset-y-0 left-0 z-30 hidden flex-col overflow-y-auto bg-linear-to-b from-navy-900 to-navy-800 text-slate-200 transition-[width] duration-200 md:flex',
          expanded ? 'w-64 shadow-2xl' : 'w-16',
        ].join(' ')}
      >
        {nav}
      </aside>
    </>
  )
}

/**
 * The full-width bar above everything: brand mark on the left, account menu
 * on the right. Nothing scopes to a particular PG here any more — picking
 * which property you're looking at is the Properties page's job now, not
 * something duplicated in the chrome above every page.
 */
function TopNavbar({ brand }: { brand: string }) {
  return (
    <header className="z-20 flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white/85 px-26 py-4 shadow-sm backdrop-blur">
      <Link to="/" className="flex shrink-0 items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-600 to-violet-600 text-sm font-bold text-white shadow-sm">
          PG
        </span>
        <span className="hidden text-base font-bold tracking-tight text-slate-900 sm:block">
          {brand}
        </span>
      </Link>

      <div className="min-w-0 flex-1" />

      <ProfileMenu />
    </header>
  )
}

/**
 * The account control, top right: avatar + name + role, opening a small menu
 * with Profile and Logout.
 *
 * Only those two actions live here — this is not a place to grow a general
 * menu. Profile is where every account action actually lives.
 */
function ProfileMenu() {
  const user = useAppSelector((state) => state.auth.user)
  const avatarUrl = useAvatar(user?.id)
  const [logout, { isLoading: loggingOut }] = useLogoutMutation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleLogout = async () => {
    setOpen(false)
    await logout().unwrap().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  const initials = (user?.full_name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const roleLabel =
    user?.staff_title ?? (user?.role === 'owner' ? 'Owner' : user?.role === 'staff' ? 'Staff' : '')

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-full border border-slate-200 py-1.5 pr-3 pl-1.5 transition-colors hover:border-slate-300 hover:bg-slate-100"
      >
        <Avatar avatarUrl={avatarUrl} initials={initials} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-slate-900">
            {user?.full_name}
          </span>
          <span className="block text-xs font-medium text-brand-600">{roleLabel}</span>
        </span>
        <IconChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-pop-in absolute top-full right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop"
        >
          <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-medium text-slate-900">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>
          <Link
            role="menuitem"
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            <IconUser className="h-4 w-4 text-slate-400" />
            Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <IconLogOut className="h-4 w-4" />
            {loggingOut ? 'Signing out…' : 'Logout'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function Avatar({
  avatarUrl,
  initials,
  size = 'md',
}: {
  avatarUrl?: string | null
  initials: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = { sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-xs', lg: 'h-16 w-16 text-lg' }[size]

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${dims} shrink-0 rounded-full object-cover ring-1 ring-slate-200`}
      />
    )
  }
  return (
    <span
      className={`flex ${dims} shrink-0 items-center justify-center rounded-full bg-linear-to-br from-navy-800 to-navy-900 font-semibold text-white`}
    >
      {initials || 'PG'}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: {
  title: string
  description?: string
  action?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
