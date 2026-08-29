import { yupResolver } from '@hookform/resolvers/yup'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'

import { Button, Card, CardTitle, ErrorNote, Field, Select, TextInput } from '@/components/ui'
import type { PGType } from '@/types/api'
import { apiErrorMessage } from '@/utils/format'

import { useUpdatePGMutation } from '../propertiesApi'
import { usePGWorkspace } from './context'

const PG_TYPE_LABEL: Record<PGType, string> = {
  girls: 'Girls',
  boys: 'Boys',
  co_living: 'Co-living',
}

const schema = yup.object({
  name: yup.string().required('PG name is required').max(150),
  pg_type: yup.string().required('Choose a PG type').oneOf(['girls', 'boys', 'co_living'] as const),
  address: yup.string().required('Address is required').max(255),
  city: yup.string().required('City is required').max(100),
  state: yup.string().required('State is required').max(100),
  pincode: yup
    .string()
    .required('Pincode is required')
    .matches(/^[0-9]{4,10}$/, 'Enter a valid pincode'),
  contact_phone: yup
    .string()
    .required('Contact phone is required')
    .matches(/^[0-9]{10,15}$/, 'Enter a 10-digit phone number'),
  contact_email: yup.string().email('Enter a valid email').nullable(),
  pg_code: yup.string().max(20).nullable(),
  description: yup.string().nullable(),
})

type Values = yup.InferType<typeof schema>

/** Guide 6 — the relatively static information about this PG, and its Edit action. */
export default function PGDetailsTab() {
  const { pg } = usePGWorkspace()
  const [editing, setEditing] = useState(false)

  // A PG created before these fields existed has blanks. Say so plainly rather
  // than rendering an empty row that looks like a rendering bug.
  const incomplete = !pg.pg_type || !pg.city || !pg.state || !pg.pincode || !pg.contact_phone

  if (editing) {
    return <DetailsForm onDone={() => setEditing(false)} />
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>PG information</CardTitle>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>

        {incomplete ? (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Some details are missing — this PG was created before they were
            collected. Use Edit to complete it.
          </p>
        ) : null}

        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row label="PG name" value={pg.name} />
          <Row label="PG type" value={pg.pg_type ? PG_TYPE_LABEL[pg.pg_type] : null} />
          <Row label="Address" value={pg.address} />
          <Row label="City" value={pg.city} />
          <Row label="State" value={pg.state} />
          <Row label="Pincode" value={pg.pincode} />
          <Row label="Contact phone" value={pg.contact_phone} />
          <Row label="Contact email" value={pg.contact_email} />
          <Row label="PG code" value={pg.pg_code} />
          <Row
            label="Created on"
            value={new Date(pg.created_at).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          />
        </dl>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Description / notes
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {pg.description || <span className="text-slate-400">—</span>}
          </p>
        </div>
      </Card>

      <Card>
        <CardTitle>Inventory</CardTitle>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Total beds</dt>
            <dd className="font-medium">{pg.total_beds}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Occupied</dt>
            <dd className="font-medium text-emerald-600">{pg.occupied_beds}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Available</dt>
            <dd className="font-medium text-amber-600">{pg.vacant_beds}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Maintenance</dt>
            <dd className="font-medium text-slate-500">{pg.maintenance_beds}</dd>
          </div>
        </dl>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">
        {value || <span className="text-slate-400">—</span>}
      </dd>
    </div>
  )
}

function DetailsForm({ onDone }: { onDone: () => void }) {
  const { pg } = usePGWorkspace()
  const [updatePG, { isLoading, error }] = useUpdatePGMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: {
      name: pg.name,
      pg_type: pg.pg_type ?? 'co_living',
      address: pg.address,
      city: pg.city ?? '',
      state: pg.state ?? '',
      pincode: pg.pincode ?? '',
      contact_phone: pg.contact_phone ?? '',
      contact_email: pg.contact_email ?? '',
      pg_code: pg.pg_code ?? '',
      description: pg.description ?? '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    const updated = await updatePG({
      pgId: pg.id,
      ...values,
      pg_type: values.pg_type,
      contact_email: values.contact_email || null,
      pg_code: values.pg_code || null,
      description: values.description || null,
    })
      .unwrap()
      .catch(() => undefined)
    if (updated) onDone()
  })

  return (
    <Card>
      <CardTitle>Edit PG information</CardTitle>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {error ? (
          <div className="sm:col-span-2">
            <ErrorNote>{apiErrorMessage(error, 'Could not save')}</ErrorNote>
          </div>
        ) : null}

        <Field label="PG name" required error={errors.name?.message}>
          <TextInput {...register('name')} />
        </Field>

        <Field label="PG type" required error={errors.pg_type?.message}>
          <Select {...register('pg_type')}>
            <option value="girls">Girls</option>
            <option value="boys">Boys</option>
            <option value="co_living">Co-living</option>
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <Field label="Address" required error={errors.address?.message}>
            <TextInput {...register('address')} />
          </Field>
        </div>

        <Field label="City" required error={errors.city?.message}>
          <TextInput {...register('city')} />
        </Field>
        <Field label="State" required error={errors.state?.message}>
          <TextInput {...register('state')} />
        </Field>
        <Field label="Pincode" required error={errors.pincode?.message}>
          <TextInput inputMode="numeric" {...register('pincode')} />
        </Field>
        <Field label="Contact phone" required error={errors.contact_phone?.message}>
          <TextInput inputMode="numeric" {...register('contact_phone')} />
        </Field>
        <Field label="Contact email" error={errors.contact_email?.message}>
          <TextInput type="email" {...register('contact_email')} />
        </Field>
        <Field label="PG code" error={errors.pg_code?.message}>
          <TextInput {...register('pg_code')} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description / notes" error={errors.description?.message}>
            <TextInput {...register('description')} />
          </Field>
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
