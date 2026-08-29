import { Link } from 'react-router-dom'

import { IconChevronRight } from './icons'

export interface BreadcrumbItem {
  label: string
  /** Omitted on the last item — the current page is not a link to itself. */
  to?: string
}

/**
 * The "where am I" trail, top-left of a page.
 *
 * Every page that is more than one level deep gets one, so getting to a floor
 * three clicks deep never requires the browser back button. The last item is
 * never a link — you are already there.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            {index > 0 ? (
              <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-700" />
            ) : null}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="cursor-pointer text-sky-500 transition-colors hover:text-sky-600 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              // The current page is deliberately not blue like the trail
              // behind it — it isn't a link, so it shouldn't look like one.
              <span className={isLast ? 'font-semibold text-slate-700' : 'text-sky-500'}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
