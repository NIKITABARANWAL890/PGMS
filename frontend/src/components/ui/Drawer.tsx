import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A slide-over panel anchored to the right edge.
 *
 * Used where a task belongs *to* the page behind it rather than replacing it —
 * configuring a floor, for instance, where the floors list is the thing you
 * return to each time. Navigating away to a full page and back loses that
 * sense of place, and makes "which floor am I on" a thing to re-establish.
 *
 * Escape closes, the backdrop closes, focus moves in on open and returns to
 * whatever opened it on close, and the page behind cannot scroll while it is up.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  width = 'lg',
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  width?: 'md' | 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  // Held in a ref so the effects below do not depend on onClose's identity.
  // Callers routinely pass an inline arrow, which changes on every parent
  // render; an effect that re-ran on that would re-focus the panel mid-typing
  // and swallow every keystroke after the first.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    openerRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)

    // Move focus into the panel once, on open, so the keyboard follows the eye.
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      openerRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const widthClass = {
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[width]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-drawer-in relative flex h-full w-full ${widthClass} flex-col bg-white shadow-2xl outline-none`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor">
              <path strokeWidth="1.6" strokeLinecap="round" d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <footer className="border-t border-slate-200 bg-slate-50/80 px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  )
}
