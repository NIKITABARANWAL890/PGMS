import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Card } from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'

import { BuildingStep } from './BuildingStep'
import { CompleteStep } from './CompleteStep'
import { FloorCountStep } from './FloorCountStep'
import { FloorsOverviewStep } from './FloorsOverviewStep'
import { PGDetailsStep } from './PGDetailsStep'
import { SetupStepper } from './SetupStepper'
import type { SetupState } from './types'

/**
 * The guided PG setup from the Owner UI guide, section 2.
 *
 * PG Details -> Building -> Floor count -> Floors Overview.
 *
 * Two things shape this flow. First, each step commits to the server as it is
 * completed rather than batching at the end: a PG with three floors and no
 * rooms is a legitimate half-finished state the owner can walk away from and
 * come back to, so there is nothing to lose by saving early and a lot to lose
 * by holding it all in memory.
 *
 * Second, Floors Overview is where the wizard *ends up*, not a step it passes
 * through. Guide 3.4 is explicit that floors are configured independently and
 * in any order, so configuring one opens a drawer over the list and returns to
 * it — the list stays on screen the whole time, which is what keeps "which
 * floor am I on" from being a question.
 */
export default function PGSetupPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<SetupState>({
    step: 'details',
    pg: null,
    buildingId: null,
    buildingName: null,
  })

  const patch = (next: Partial<SetupState>) => setState((prev) => ({ ...prev, ...next }))

  return (
    <>
      <PageHeader
        title="PG setup"
        breadcrumbs={[
          { label: 'Dashboard', to: '/' },
          { label: 'Properties', to: '/properties' },
          { label: 'Add PG' },
        ]}
        description="Define the property, then its structure. You can leave and pick this up later — every step is saved as you go."
      />

      <SetupStepper current={state.step} />

      <Card className="mt-5">
        {state.step === 'details' ? (
          <PGDetailsStep
            onCreated={(pg) => patch({ pg, step: 'building' })}
            onCancel={() => navigate('/properties')}
          />
        ) : null}

        {state.step === 'building' && state.pg ? (
          <BuildingStep
            pg={state.pg}
            onReady={(buildingId, buildingName) =>
              patch({ buildingId, buildingName, step: 'floor-count' })
            }
            onBack={() => patch({ step: 'details' })}
          />
        ) : null}

        {state.step === 'floor-count' && state.pg && state.buildingId ? (
          <FloorCountStep
            pgId={state.pg.id}
            buildingId={state.buildingId}
            buildingName={state.buildingName ?? 'Building'}
            onGenerated={() => patch({ step: 'floors' })}
            onBack={() => patch({ step: 'building' })}
          />
        ) : null}

        {state.step === 'floors' && state.pg ? (
          <FloorsOverviewStep
            pgId={state.pg.id}
            onAddBuilding={() => patch({ step: 'building' })}
            onFinish={() => patch({ step: 'complete' })}
          />
        ) : null}


        {state.step === 'complete' && state.pg ? (
          <CompleteStep pg={state.pg} />
        ) : null}
      </Card>
    </>
  )
}
