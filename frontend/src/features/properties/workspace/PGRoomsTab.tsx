import { FloorsOverviewStep } from '../setup/FloorsOverviewStep'
import { usePGWorkspace } from './context'

/**
 * Guide 8 — rooms, floor-wise.
 *
 * Deliberately the same component the setup wizard ends on. Configuring a floor
 * should not behave differently depending on whether the PG was created five
 * minutes or five months ago, and two implementations of one screen is how they
 * drift apart.
 */
export default function PGRoomsTab() {
  const { pg } = usePGWorkspace()
  return <FloorsOverviewStep pgId={pg.id} workspaceMode />
}
