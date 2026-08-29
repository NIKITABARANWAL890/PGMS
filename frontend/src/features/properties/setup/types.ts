import type { PGSummary } from '@/types/api'

export type SetupStep =
  | 'details'
  | 'building'
  | 'floor-count'
  | 'floors'
  | 'complete'

/**
 * What the wizard carries between steps.
 *
 * Only ids and labels — never the entities themselves. Each step reads live
 * data from the server, so a value here going stale cannot put wrong numbers on
 * screen; at worst a label is out of date, which the step's own query corrects.
 */
export interface SetupState {
  step: SetupStep
  pg: PGSummary | null
  buildingId: string | null
  buildingName: string | null
}

export const STEP_LABELS: { key: SetupStep; label: string }[] = [
  { key: 'details', label: 'PG Details' },
  { key: 'building', label: 'Building' },
  { key: 'floor-count', label: 'Floors' },
  { key: 'floors', label: 'Rooms & Beds' },
  { key: 'complete', label: 'Complete' },
]
