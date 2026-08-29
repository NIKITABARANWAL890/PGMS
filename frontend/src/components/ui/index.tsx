import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ------------------------------------------------------------------ Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-500 active:bg-brand-700 disabled:bg-brand-600/40 disabled:shadow-none',
  secondary:
    'bg-white text-slate-700 border border-slate-300 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:shadow-none',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700 disabled:bg-red-600/40 disabled:shadow-none',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium',
        'transition-all duration-150 focus:outline-none focus-visible:ring-2',
        'focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        BUTTON_STYLES[variant],
        className,
      )}
    />
  )
}

// -------------------------------------------------------------------- Card

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cx(
        'rounded-xl border border-slate-200/80 bg-white p-5 shadow-card',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-base font-semibold tracking-tight text-slate-900">{children}</h2>
}

/** The dashboard metric tile from the wireframe: label, big number, sub-note. */
export function MetricCard({
  label,
  value,
  note,
  tone = 'default',
  icon,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: 'default' | 'positive' | 'warning' | 'muted'
  icon?: ReactNode
}) {
  const valueTone = {
    default: 'text-slate-900',
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
    muted: 'text-slate-400',
  }[tone]

  return (
    <div className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          {label}
        </p>
        {icon ? <span className="text-slate-300">{icon}</span> : null}
      </div>
      <p className={cx('tabular mt-2 text-2xl font-semibold tracking-tight', valueTone)}>
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  )
}

// ------------------------------------------------------------------- Badge

type BadgeTone = 'green' | 'amber' | 'red' | 'blue' | 'slate'

const BADGE_STYLES: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

export function Badge({ tone = 'slate', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_STYLES[tone],
      )}
    >
      {children}
    </span>
  )
}

// ------------------------------------------------------------- form fields

interface FieldProps {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
  hint?: string
}

export function Field({ label, error, required, hint, children }: FieldProps) {
  // Hint and error sit OUTSIDE the <label> deliberately. Text inside a wrapping
  // label becomes part of the control's accessible name, so a hint kept in here
  // would have a screen reader announce the field as
  // "Monthly rent Optional — per bed, in ₹" instead of "Monthly rent".
  return (
    <div className="block">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          {/* Decorative: the asterisk is a visual convention, and letting it into
              the accessible name makes every required field read "Name star". */}
          {required ? (
            <span aria-hidden className="text-red-500">
              {}
              *
            </span>
          ) : null}
        </span>
        {children}
      </label>
      {hint && !error ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </div>
  )
}

const CONTROL_CLASSES =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm ' +
  'transition-colors placeholder:text-slate-400 hover:border-slate-400 ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL_CLASSES, className)} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CONTROL_CLASSES, className)} />
}

// ------------------------------------------------------------------ states

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
      />
      {label}…
    </div>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {children}
    </div>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export { Drawer } from './Drawer'
export { ConfirmDelete } from './ConfirmDelete'
export { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
export * as Icon from './icons'
