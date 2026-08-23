import { yupResolver } from '@hookform/resolvers/yup'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import * as yup from 'yup'

import { Button, Card, ErrorNote, Field, Spinner, TextInput } from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { pgSelected } from '@/features/properties/selectedPgSlice'
import { useAppDispatch } from '@/hooks/redux'
import type { PGSummary } from '@/types/api'
import { apiErrorMessage, occupancyPercent } from '@/utils/format'

import { useCreatePGMutation, useListPGsQuery } from './propertiesApi'

const schema = yup.object({
  name: yup.string().required('PG name is required').max(150),
  address: yup.string().required('Address is required').max(255),
})

type PGValues = yup.InferType<typeof schema>

export default function PropertiesPage() {
  const { data: pgs = [], isLoading } = useListPGsQuery()
  const [showForm, setShowForm] = useState(false)
  const dispatch = useAppDispatch()

  const columns: Column<PGSummary>[] = [
    {
      header: 'PG name',
      cell: (pg) => (
        <Link
          to={`/properties/${pg.id}`}
          className="font-medium text-brand-600 hover:underline"
        >
          {pg.name}
        </Link>
      ),
    },
    { header: 'Address', cell: (pg) => pg.address },
    { header: 'Total beds', align: 'right', cell: (pg) => pg.total_beds },
    {
      header: 'Occupied',
      align: 'right',
      cell: (pg) => (
        <span className="text-emerald-600">
          {pg.occupied_beds}{' '}
          <span className="text-xs text-slate-400">
            ({occupancyPercent(pg.occupied_beds, pg.total_beds)})
          </span>
        </span>
      ),
    },
    {
      header: 'Vacant',
      align: 'right',
      cell: (pg) => <span className="text-amber-600">{pg.vacant_beds}</span>,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (pg) => (
        <div className="flex justify-end gap-3">
          <Link
            to={`/properties/${pg.id}`}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            Details
          </Link>
          <Link
            to="/rooms-and-beds"
            onClick={() => dispatch(pgSelected(pg.id))}
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            Rooms &amp; beds
          </Link>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Properties"
        description="Every PG on this account. Open one to add its buildings, floors, rooms and beds."
        action={
          <Button onClick={() => setShowForm((open) => !open)}>
            {showForm ? 'Cancel' : '+ Add PG'}
          </Button>
        }
      />

      {showForm ? <AddPGForm onDone={() => setShowForm(false)} /> : null}

      {isLoading ? (
        <Spinner label="Loading properties" />
      ) : (
        <DataTable
          columns={columns}
          rows={pgs}
          rowKey={(pg) => pg.id}
          emptyMessage="No PGs yet — add your first one to get started."
        />
      )}
    </>
  )
}

function AddPGForm({ onDone }: { onDone: () => void }) {
  const [createPG, { isLoading, error }] = useCreatePGMutation()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PGValues>({ resolver: yupResolver(schema) })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createPG(values).unwrap()
      reset()
      onDone()
      // A PG is only a name and an address until it has rooms and beds, so
      // hand the owner straight to the page where those get added.
      navigate(`/properties/${created.id}`)
    } catch {
      /* surfaced through `error` below */
    }
  })

  return (
    <Card className="mb-5">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {error ? (
          <div className="sm:col-span-2">
            <ErrorNote>{apiErrorMessage(error, 'Could not create the PG')}</ErrorNote>
          </div>
        ) : null}

        <Field label="PG name" required error={errors.name?.message}>
          <TextInput placeholder="Sunrise PG" {...register('name')} />
        </Field>

        <Field label="Address" required error={errors.address?.message}>
          <TextInput placeholder="Koramangala, Bangalore" {...register('address')} />
        </Field>

        <div className="sm:col-span-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Adding…' : 'Add PG'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
