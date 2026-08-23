import { useState } from 'react'

import { Badge, Button, Card, ErrorNote, Field, Select, TextInput } from '@/components/ui'
import { useListPGsQuery } from '@/features/properties/propertiesApi'
import type { PGSummary, StaffCreated } from '@/types/api'
import { apiErrorMessage } from '@/utils/format'

import { useCreateStaffMutation } from './staffApi'

/**
 * The Add Staff wizard: Basic Information → Assign PG(s) → Review & Add.
 *
 * Three steps, exactly as the wireframe shows. There is deliberately no fourth
 * permissions step: every staff member gets the same fixed capability set, and
 * the only thing that varies per person is which PGs they can reach — which is
 * step 2. The "Role" dropdown below is a display label, not a permission tier.
 *
 * State is held locally across the steps and submitted once, on step 3, so a
 * half-filled wizard never creates a partial account.
 */

const STAFF_TITLES = ['Manager', 'Assistant Manager', 'Housekeeping', 'Maintenance', 'Security']

interface BasicInfo {
  full_name: string
  phone: string
  email: string
  staff_title: string
}

const EMPTY_BASIC: BasicInfo = {
  full_name: '',
  phone: '',
  email: '',
  staff_title: 'Manager',
}

export function AddStaffForm({ onDone }: { onDone: () => void }) {
  const { data: pgs = [] } = useListPGsQuery()
  const [createStaff, { isLoading, error }] = useCreateStaffMutation()

  const [step, setStep] = useState(1)
  const [basic, setBasic] = useState<BasicInfo>(EMPTY_BASIC)
  const [selectedPgIds, setSelectedPgIds] = useState<string[]>([])
  const [created, setCreated] = useState<StaffCreated | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  if (created) {
    return <StaffCreatedNotice staff={created} onDone={onDone} />
  }

  const goToStep2 = () => {
    if (!basic.full_name.trim()) return setValidationError('Full name is required')
    if (!/^[0-9]{10,15}$/.test(basic.phone)) {
      return setValidationError('Enter a 10-digit phone number')
    }
    if (!/^\S+@\S+\.\S+$/.test(basic.email)) {
      return setValidationError('Enter a valid email address')
    }
    setValidationError(null)
    setStep(2)
  }

  const goToStep3 = () => {
    if (selectedPgIds.length === 0) {
      return setValidationError('Select at least one PG for this staff member')
    }
    setValidationError(null)
    setStep(3)
  }

  const submit = async () => {
    try {
      const result = await createStaff({
        full_name: basic.full_name.trim(),
        phone: basic.phone.trim(),
        email: basic.email.trim(),
        staff_title: basic.staff_title || null,
        pg_ids: selectedPgIds,
      }).unwrap()
      setCreated(result)
    } catch {
      /* surfaced through `error` */
    }
  }

  return (
    <Card className="mb-6">
      <StepIndicator step={step} />

      {validationError ? (
        <div className="mb-4">
          <ErrorNote>{validationError}</ErrorNote>
        </div>
      ) : null}
      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not create the staff account')}</ErrorNote>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <TextInput
              value={basic.full_name}
              onChange={(e) => setBasic({ ...basic, full_name: e.target.value })}
              placeholder="Suresh Singh"
            />
          </Field>

          <Field label="Role" hint="A display label only — it grants no extra access.">
            <Select
              value={basic.staff_title}
              onChange={(e) => setBasic({ ...basic, staff_title: e.target.value })}
            >
              {STAFF_TITLES.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Phone number" required>
            <TextInput
              value={basic.phone}
              onChange={(e) => setBasic({ ...basic, phone: e.target.value })}
              inputMode="numeric"
              placeholder="9876543210"
            />
          </Field>

          <Field label="Email" required>
            <TextInput
              value={basic.email}
              onChange={(e) => setBasic({ ...basic, email: e.target.value })}
              type="email"
              placeholder="suresh@example.com"
            />
          </Field>

          <div className="flex gap-2 sm:col-span-2">
            <Button variant="secondary" type="button" onClick={onDone}>
              Cancel
            </Button>
            <Button type="button" onClick={goToStep2}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="mb-3 text-sm text-slate-600">
            Select the PGs this staff member will have access to.
          </p>
          <div className="space-y-2">
            {pgs.map((pg: PGSummary) => (
              <label
                key={pg.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  checked={selectedPgIds.includes(pg.id)}
                  onChange={(event) =>
                    setSelectedPgIds((current) =>
                      event.target.checked
                        ? [...current, pg.id]
                        : current.filter((id) => id !== pg.id),
                    )
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">{pg.name}</span>
                  <span className="block text-xs text-slate-500">{pg.address}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="button" onClick={goToStep3}>
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Staff information</h3>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Review label="Full name" value={basic.full_name} />
            <Review label="Role" value={basic.staff_title} />
            <Review label="Phone" value={basic.phone} />
            <Review label="Email" value={basic.email} />
          </dl>

          <h3 className="mt-5 mb-2 text-sm font-semibold text-slate-900">Assigned PG(s)</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {pgs
              .filter((pg) => selectedPgIds.includes(pg.id))
              .map((pg) => (
                <li key={pg.id}>• {pg.name}</li>
              ))}
          </ul>

          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            All staff members receive the same fixed permission set: manage complaints,
            manage move-out inspections, view tenants/rooms/beds for assigned PG(s), and
            view (not create) bills.
          </p>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" type="button" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button type="button" onClick={submit} disabled={isLoading}>
              {isLoading ? 'Adding…' : 'Add staff'}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || '—'}</dd>
    </div>
  )
}

function StepIndicator({ step }: { step: number }) {
  const steps = ['Basic Information', 'Assign PG(s)', 'Review & Add']
  return (
    <ol className="mb-6 flex flex-wrap gap-4">
      {steps.map((label, index) => {
        const number = index + 1
        const state =
          number === step ? 'current' : number < step ? 'done' : 'upcoming'
        return (
          <li key={label} className="flex items-center gap-2 text-sm">
            <span
              className={[
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                state === 'current'
                  ? 'bg-brand-600 text-white'
                  : state === 'done'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500',
              ].join(' ')}
            >
              {number}
            </span>
            <span className={state === 'upcoming' ? 'text-slate-400' : 'text-slate-800'}>
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Staff do not choose their own password, so the owner has to be given one to
 * pass on. It is shown once here and never again — the server only keeps a hash.
 */
function StaffCreatedNotice({ staff, onDone }: { staff: StaffCreated; onDone: () => void }) {
  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Badge tone="green">Staff added</Badge>
        <h3 className="text-sm font-semibold text-slate-900">{staff.full_name}</h3>
      </div>

      <p className="text-sm text-slate-600">
        Share these sign-in details with {staff.full_name}. The temporary password is
        shown only now — it cannot be retrieved later.
      </p>

      <dl className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <Review label="Email (used to sign in)" value={staff.email ?? '—'} />
        <div>
          <dt className="text-xs text-slate-500">Temporary password</dt>
          <dd className="font-mono text-slate-900">{staff.temporary_password}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </div>
    </Card>
  )
}
