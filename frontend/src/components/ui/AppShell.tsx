import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { useLogoutMutation } from '@/features/auth/authApi'
import { useAppSelector } from '@/hooks/redux'

export interface NavItem {
  label: string
  to: string
  /** Phase 2-6 screens are listed but not reachable yet — see NavLink below. */
  comingSoon?: boolean
}

/**
 * The sidebar layout both roles use.
 *
 * Owner and staff get visibly different shells (different branding, different
 * nav) because the wireframes show them as two apps, not one app with items
 * hidden. The header PG switcher is passed in rather than built here, since
 * owners switch across all their PGs and staff only across assigned ones.
 */
export function AppShell({
  brand,
  navItems,
  switcher,
  children,
}: {
  brand: string
  navItems: NavItem[]
  switcher?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-900 text-slate-200 md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-base font-semibold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm">
            PG
          </span>
          {brand}
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {navItems.map((item) =>
            item.comingSoon ? (
              <span
                key={item.label}
                title="Arrives in a later phase"
                className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-500"
              >
                {item.label}
                <span className="text-[10px] tracking-wide uppercase">soon</span>
              </span>
            ) : (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'block rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-brand-600 font-medium text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="text-sm font-semibold text-slate-900 md:hidden">{brand}</div>
          {switcher}
          <UserMenu />
        </header>

        <main className="flex-1 overflow-x-hidden px-6 py-6">{children}</main>
      </div>
    </div>
  )
}

/**
 * The account block, top right.
 *
 * The whole block is a link to the profile page — that is the one thing people
 * reach for when they click their own name, so it should not be hidden behind a
 * menu. Sign out sits beside it rather than inside it, so ending your session
 * is never one click away from a page you meant to open.
 */
function UserMenu() {
  const user = useAppSelector((state) => state.auth.user)
  const [logout, { isLoading: loggingOut }] = useLogoutMutation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout().unwrap().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  const initials = (user?.full_name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="ml-auto flex items-center gap-3">
      <Link
        to="/profile"
        title="View your profile"
        className="flex items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
          {initials || 'PG'}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-medium text-slate-900">
            {user?.full_name}
          </span>
          <span className="block text-xs text-slate-500">
            {user?.email ?? user?.phone}
          </span>
        </span>
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {loggingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
