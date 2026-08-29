import { useState } from 'react'

import { Button, ErrorNote } from '@/components/ui'
import { apiErrorMessage } from '@/utils/format'

/**
 * A delete confirmation that asks you to type the thing's name.
 *
 * Deleting a PG or a building takes its whole subtree with it, and a plain
 * "Are you sure?" is dismissed on reflex. Typing the name forces a moment of
 * reading, and — more usefully — proves you are looking at the row you think
 * you are, which is the actual failure mode in a list of similar names.
 */
export function ConfirmDelete({
  open,
  onCancel,
  onConfirm,
  itemName,
  itemKind,
  consequence,
  busy,
  error,
  requireTyping = true,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  itemName: string
  itemKind: string
  consequence?: string
  busy?: boolean
  error?: unknown
  /** Low-stakes deletes (a single bed) do not need the typing gate. */
  requireTyping?: boolean
}) {
  const [typed, setTyped] = useState('')

  if (!open) return null

  const confirmed = !requireTyping || typed.trim() === itemName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${itemKind}`}
        className="animate-pop-in relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-red-600" fill="none" stroke="currentColor">
            <path
              strokeWidth="1.8"
              strokeLinecap="round"
              d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"
            />
          </svg>
        </div>

        <h2 className="text-base font-semibold text-slate-900">Delete this {itemKind}?</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          <strong className="text-slate-900">{itemName}</strong>
          {consequence ? ` ${consequence}` : ''} This cannot be undone.
        </p>

        {error ? (
          <div className="mt-4">
            <ErrorNote>{apiErrorMessage(error, 'Could not delete')}</ErrorNote>
          </div>
        ) : null}

        {requireTyping ? (
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              Type <span className="font-mono text-slate-900">{itemName}</span> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
            />
          </label>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!confirmed || busy}>
            {busy ? 'Deleting…' : `Delete ${itemKind}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
