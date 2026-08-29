import { STEP_LABELS, type SetupStep } from './types'

/** The numbered progress rail across the top of the setup wireframe. */
export function SetupStepper({ current }: { current: SetupStep }) {
  const currentIndex = STEP_LABELS.findIndex((s) => s.key === current)

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
      {STEP_LABELS.map((step, index) => {
        const done = index < currentIndex
        const active = index === currentIndex
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={[
                'flex items-center gap-2 rounded-full px-3 py-1',
                active
                  ? 'bg-brand-600 font-medium text-white'
                  : done
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              <span className="text-xs font-semibold">{done ? '✓' : index + 1}</span>
              {step.label}
            </span>
            {index < STEP_LABELS.length - 1 ? (
              <span aria-hidden className="text-slate-300">
                →
              </span>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
