import { useOutletContext } from 'react-router-dom'

import type { PGSummary } from '@/types/api'

export interface PGWorkspaceContext {
  pg: PGSummary
}

/**
 * The PG every workspace tab is scoped to.
 *
 * The layout has already fetched and access-checked it, so tabs read it from
 * context instead of each firing their own request for the same record.
 */
export function usePGWorkspace(): PGWorkspaceContext {
  return useOutletContext<PGWorkspaceContext>()
}
