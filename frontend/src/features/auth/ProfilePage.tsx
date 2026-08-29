import { yupResolver } from '@hookform/resolvers/yup'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as yup from 'yup'

import { Badge, Button, Card, CardTitle, ErrorNote, Field, TextInput } from '@/components/ui'
import { Avatar, PageHeader } from '@/components/ui/AppShell'
import { IconCamera } from '@/components/ui/icons'
import { useAvatar } from '@/hooks/useAvatar'
import { useAppSelector } from '@/hooks/redux'
import { apiErrorMessage } from '@/utils/format'
import { clearAvatar, readImageFile, setAvatar } from '@/utils/avatar'

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
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Profile' }]}
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

      <div className="mb-5 flex items-center gap-4">
        <PhotoUpload userId={user?.id} fullName={user?.full_name} />

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Role</span>
          <Badge tone={user?.role === 'owner' ? 'blue' : 'green'}>
            {user?.staff_title ?? user?.role}
          </Badge>
        </div>
      </div>
      {user?.role === 'staff' ? (
        <p className="-mt-3 mb-4 text-xs text-slate-500">
          A label — access comes from your assigned PGs.
        </p>
      ) : null}

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

/**
 * The profile photo control, to the left of the role badge.
 *
 * Stored client-side only (see `utils/avatar.ts`) — there is no `avatar_url`
 * column in the schema for any phase, and adding real file storage is a
 * backend decision this task did not ask for. This gives the upload a working
 * home in the UI, on this device, without inventing that infrastructure.
 */
function PhotoUpload({ userId, fullName }: { userId?: string; fullName?: string }) {
  const avatarUrl = useAvatar(userId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const initials = (fullName ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return
    setUploadError(null)
    try {
      const dataUrl = await readImageFile(file)
      setAvatar(userId, dataUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not use that photo.')
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="group relative">
        <Avatar avatarUrl={avatarUrl} initials={initials} size="lg" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload profile photo"
          title="Upload profile photo"
          className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow-sm transition-colors hover:bg-brand-500"
        >
          <IconCamera className="h-3.5 w-3.5" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onPick}
          className="sr-only"
        />
      </div>
      {avatarUrl ? (
        <button
          type="button"
          onClick={() => userId && clearAvatar(userId)}
          className="text-[11px] text-slate-400 transition-colors hover:text-red-600"
        >
          Remove
        </button>
      ) : (
        <span className="text-[11px] text-slate-400">Upload photo</span>
      )}
      {uploadError ? <p className="max-w-28 text-center text-[11px] text-red-600">{uploadError}</p> : null}
    </div>
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
