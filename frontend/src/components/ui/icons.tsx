import type { SVGProps } from 'react'

/**
 * A small hand-picked icon set, inline rather than a dependency.
 *
 * Every icon shares one visual grammar — 24-unit viewBox, no fill, 1.8 stroke,
 * rounded caps/joins — matching the delete/close glyphs already in the app, so
 * adding a library wouldn't buy consistency we don't already have and would
 * cost a dependency for ~20 glyphs we can hand-draw once.
 */
type IconProps = SVGProps<SVGSVGElement>

function base(children: React.ReactNode, props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconDashboard = (p: IconProps) =>
  base(
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    </>,
    p,
  )

export const IconBuilding = (p: IconProps) =>
  base(
    <>
      <rect x="4" y="3" width="12" height="18" rx="1" />
      <path d="M16 21h4V9l-4-2" />
      <path d="M7.5 7h1M11.5 7h1M7.5 11h1M11.5 11h1M7.5 15h1M11.5 15h1" />
    </>,
    p,
  )

export const IconUsers = (p: IconProps) =>
  base(
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" />
      <circle cx="17" cy="8.5" r="2.5" />
      <path d="M15.7 14.8c2.4.4 4.3 2.4 4.3 5.2" />
    </>,
    p,
  )

export const IconReceipt = (p: IconProps) =>
  base(
    <>
      <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>,
    p,
  )

export const IconMessage = (p: IconProps) =>
  base(
    <>
      <path d="M4 5h16v11H8l-4 4V5Z" />
      <path d="M8 9h8M8 12h5" />
    </>,
    p,
  )

export const IconChart = (p: IconProps) =>
  base(
    <>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M3 20h18" />
    </>,
    p,
  )

export const IconBell = (p: IconProps) =>
  base(
    <>
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>,
    p,
  )

export const IconSettings = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.14.36.38.68.68.92.3.24.65.38 1.02.4H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </>,
    p,
  )

export const IconInfo = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 8v.01" />
    </>,
    p,
  )

export const IconLayers = (p: IconProps) =>
  base(
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
    </>,
    p,
  )

export const IconDoor = (p: IconProps) =>
  base(
    <>
      <path d="M5 21V4a1 1 0 0 1 1-1h9l4 3v15" />
      <path d="M5 21h14" />
      <path d="M14.5 12.5v.01" />
    </>,
    p,
  )

export const IconBed = (p: IconProps) =>
  base(
    <>
      <path d="M3 19v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7" />
      <path d="M3 19v2M21 19v2" />
      <path d="M3 13V7a1 1 0 0 1 1-1h6v4" />
      <circle cx="7.5" cy="8" r="1.4" />
    </>,
    p,
  )

export const IconFolder = (p: IconProps) =>
  base(<path d="M4 6.5a1 1 0 0 1 1-1h4.5l2 2.5H19a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5Z" />, p)

export const IconActivity = (p: IconProps) =>
  base(<path d="M3 12h4l2 7 4-14 2 7h6" />, p)

export const IconChevronDown = (p: IconProps) => base(<path d="M6 9l6 6 6-6" />, p)

export const IconChevronRight = (p: IconProps) => base(<path d="M9 6l6 6-6 6" />, p)

export const IconCamera = (p: IconProps) =>
  base(
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.6l1-1.8A1 1 0 0 1 9 4.7h6a1 1 0 0 1 .9.5l1 1.8h1.6A1.5 1.5 0 0 1 20 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8.5Z" />
      <circle cx="12" cy="13" r="3.4" />
    </>,
    p,
  )

export const IconLogOut = (p: IconProps) =>
  base(
    <>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>,
    p,
  )

export const IconUser = (p: IconProps) =>
  base(
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" />
    </>,
    p,
  )

export const IconHome = (p: IconProps) =>
  base(
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5a1 1 0 0 0 1 1h3.5v-6h3v6H17a1 1 0 0 0 1-1V10" />
    </>,
    p,
  )
