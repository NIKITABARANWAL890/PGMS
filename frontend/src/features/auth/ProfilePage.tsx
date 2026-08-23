import { yupResolver } from '@hookform/resolvers/yup'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'

import { Badge, Button, Card, CardTitle, ErrorNote, Field, TextInput } from '@/components/ui'
import { PageHeader } from '@/components/ui/AppShell'
import { useAppSelector } from '@/hooks/redux'
import { apiErrorMessage } from '@/utils/format'

import { useChangePasswordMutation, useUpdateProfileMutation } from './authApi'

const profileSchema = yup.object({
  full_name: yup.string().required('Full name is required').max(150),
  email: yup.string().required('Email is required').email('Enter a valid email'),
  phone: yup
    .string()
    .required('Phone number is required')
    .matches(/^[0-9]{10,15}$/, 'Enter a 10-digit phone number'),
})

const passwordSchema = yup.object({
  current_password: yup.string().required('Enter your current password'),
  new_password: yup
    .string()
    .required('Enter a new password')
    .min(8, 'Use at least 8 characters'),
  confirm_password: yup
    .string()
    .required('Confirm your new password')
    .oneOf([yup.ref('new_password')], 'Passwords do not match'),
})

type ProfileValues = yup.InferType<typeof profileSchema>
type PasswordValues = yup.InferType<typeof passwordSchema>

/**
 * The signed-in user's own profile — same page for owners and staff.
 *
 * Role is shown but not editable: nobody promotes themselves, in any phase.
 */
export default function ProfilePage() {
  const user = useAppSelector((state) => state.auth.user)

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your account details and password."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileDetailsCard key={user?.id} />
        <PasswordCard />
      </div>
    </>
  )
}

function ProfileDetailsCard() {
  const user = useAppSelector((state) => state.auth.user)
  const [updateProfile, { isLoading, error }] = useUpdateProfileMutation()
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    },
  })

  // The user arrives from a cached render sometimes, so re-seed the form once
  // the real record lands rather than leaving the fields blank.
  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name,
        email: user.email ?? '',
        phone: user.phone,
      })
    }
  }, [user, reset])

  const onSubmit = handleSubmit(async (values) => {
    setSaved(false)
    const updated = await updateProfile(values)
      .unwrap()
      .catch(() => undefined)
    if (updated) {
      setSaved(true)
      reset(values)
    }
  })

  return (
    <Card>
      <CardTitle>Account details</CardTitle>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <span className="text-slate-500">Role</span>
        <Badge tone={user?.role === 'owner' ? 'blue' : 'green'}>
          {user?.staff_title ?? user?.role}
        </Badge>
        {user?.role === 'staff' ? (
          <span className="text-xs text-slate-500">
            (a label — access comes from your assigned PGs)
          </span>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <ErrorNote>{apiErrorMessage(error, 'Could not save your profile')}</ErrorNote>
        ) : null}
        {saved && !isDirty ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Profile updated.
          </p>
        ) : null}

        <Field label="Full name" required error={errors.full_name?.message}>
          <TextInput {...register('full_name')} />
        </Field>

        <Field label="Email" required error={errors.email?.message}>
          <TextInput type="email" {...register('email')} />
        </Field>

        <Field label="Phone number" required error={errors.phone?.message}>
          <TextInput inputMode="numeric" {...register('phone')} />
        </Field>

        <Button type="submit" disabled={isLoading || !isDirty}>
          {isLoading ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </Card>
  )
}

function PasswordCard() {
  const user = useAppSelector((state) => state.auth.user)
  const [changePassword, { isLoading, error }] = useChangePasswordMutation()
  const [changed, setChanged] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordValues>({ resolver: yupResolver(passwordSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setChanged(false)
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      }).unwrap()
      setChanged(true)
      reset()
    } catch {
      /* surfaced through `error` */
    }
  })

  return (
    <Card>
      <CardTitle>Change password</CardTitle>

      {user?.role === 'staff' ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your account was created with a temporary password chosen by the owner.
          Setting your own is worth doing now.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <ErrorNote>{apiErrorMessage(error, 'Could not change your password')}</ErrorNote>
        ) : null}
        {changed ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password changed. Any other devices you were signed in on have been
            signed out.
          </p>
        ) : null}

        <Field label="Current password" required error={errors.current_password?.message}>
          <TextInput
            type="password"
            autoComplete="current-password"
            {...register('current_password')}
          />
        </Field>

        <Field
          label="New password"
          required
          error={errors.new_password?.message}
          hint="At least 8 characters."
        >
          <TextInput
            type="password"
            autoComplete="new-password"
            {...register('new_password')}
          />
        </Field>

        <Field label="Confirm new password" required error={errors.confirm_password?.message}>
          <TextInput
            type="password"
            autoComplete="new-password"
            {...register('confirm_password')}
          />
        </Field>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </Card>
  )
}
