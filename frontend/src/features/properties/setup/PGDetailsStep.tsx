import { yupResolver } from '@hookform/resolvers/yup'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'

import { Button, ErrorNote, Field, Select, TextInput } from '@/components/ui'
import type { PGSummary } from '@/types/api'
import { apiErrorMessage } from '@/utils/format'

import { useCreatePGMutation, type PGDetailsBody } from '../propertiesApi'

/** Guide 3.1 — required there is required here. */
const schema = yup.object({
  name: yup.string().required('PG name is required').max(150),
  pg_type: yup
    .string()
    .required('Choose a PG type')
    .oneOf(['girls', 'boys', 'co_living'] as const),
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

export function PGDetailsStep({
  onCreated,
  onCancel,
}: {
  onCreated: (pg: PGSummary) => void
  onCancel: () => void
}) {
  const [createPG, { isLoading, error }] = useCreatePGMutation()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: yupResolver(schema),
    defaultValues: { pg_type: 'co_living' },
  })

  const onSubmit = handleSubmit(async (values) => {
    const body: PGDetailsBody = {
      ...values,
      pg_type: values.pg_type,
      contact_email: values.contact_email || null,
      pg_code: values.pg_code || null,
      description: values.description || null,
    }
    const created = await createPG(body)
      .unwrap()
      .catch(() => undefined)
    if (created) onCreated(created)
  })

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 className="text-base font-semibold text-slate-900">Basic information</h2>
      <p className="mt-1 mb-5 text-sm text-slate-600">
        Enter basic information about your PG. Structure comes next.
      </p>

      {error ? (
        <div className="mb-4">
          <ErrorNote>{apiErrorMessage(error, 'Could not create the PG')}</ErrorNote>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PG name" required error={errors.name?.message}>
          <TextInput placeholder="Sunrise PG" {...register('name')} />
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
            <TextInput placeholder="24th Main, Koramangala" {...register('address')} />
          </Field>
        </div>

        <Field label="City" required error={errors.city?.message}>
          <TextInput placeholder="Bengaluru" {...register('city')} />
        </Field>

        <Field label="State" required error={errors.state?.message}>
          <TextInput placeholder="Karnataka" {...register('state')} />
        </Field>

        <Field label="Pincode" required error={errors.pincode?.message}>
          <TextInput placeholder="560034" inputMode="numeric" {...register('pincode')} />
        </Field>

        <Field label="Contact phone" required error={errors.contact_phone?.message}>
          <TextInput
            placeholder="9876543210"
            inputMode="numeric"
            {...register('contact_phone')}
          />
        </Field>

        <Field label="Contact email" error={errors.contact_email?.message}>
          <TextInput
            type="email"
            placeholder="sunrise@example.com"
            {...register('contact_email')}
          />
        </Field>

        <Field
          label="PG code"
          error={errors.pg_code?.message}
          hint="Your own identifier, e.g. SPG001."
        >
          <TextInput placeholder="SPG001" {...register('pg_code')} />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Description / notes" error={errors.description?.message}>
            <TextInput
              placeholder="Near metro, fully furnished"
              {...register('description')}
            />
          </Field>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving…' : 'Save & next'}
        </Button>
      </div>
    </form>
  )
}
