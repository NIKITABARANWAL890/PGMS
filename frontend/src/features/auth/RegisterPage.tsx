import { yupResolver } from '@hookform/resolvers/yup'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import * as yup from 'yup'

import { Button, ErrorNote, Field, TextInput } from '@/components/ui'
import { useAppSelector } from '@/hooks/redux'
import { apiErrorMessage } from '@/utils/format'

import { AuthLayout } from './LoginPage'
import { useRegisterMutation } from './authApi'

// Mirrors the backend's own rules, so the obvious mistakes are caught before a
// round trip. The server re-validates regardless — this is convenience, not
// the actual check.
const schema = yup.object({
  full_name: yup.string().required('Full name is required').max(150),
  email: yup.string().required('Email is required').email('Enter a valid email'),
  phone: yup
    .string()
    .required('Phone number is required')
    .matches(/^[0-9]{10,15}$/, 'Enter a 10-digit phone number'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Use at least 8 characters'),
  confirm_password: yup
    .string()
    .required('Confirm your password')
    .oneOf([yup.ref('password')], 'Passwords do not match'),
})

type RegisterValues = yup.InferType<typeof schema>

export default function RegisterPage() {
  const [registerOwner, { isLoading, error }] = useRegisterMutation()
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: yupResolver(schema) })

  if (accessToken) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async (values) => {
    await registerOwner({
      full_name: values.full_name,
      email: values.email,
      phone: values.phone,
      password: values.password,
    })
      .unwrap()
      .catch(() => undefined)
  })

  return (
    <AuthLayout
      title="Create an owner account"
      subtitle="Staff accounts are created by an owner, not signed up for here."
      footer={
        <p className="text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <ErrorNote>{apiErrorMessage(error, 'Could not create the account')}</ErrorNote>
        ) : null}

        <Field label="Full name" required error={errors.full_name?.message}>
          <TextInput placeholder="Amit Sharma" {...register('full_name')} />
        </Field>

        <Field label="Email" required error={errors.email?.message}>
          <TextInput type="email" placeholder="you@example.com" {...register('email')} />
        </Field>

        <Field label="Phone number" required error={errors.phone?.message}>
          <TextInput inputMode="numeric" placeholder="9876543210" {...register('phone')} />
        </Field>

        <Field
          label="Password"
          required
          error={errors.password?.message}
          hint="At least 8 characters."
        >
          <TextInput type="password" autoComplete="new-password" {...register('password')} />
        </Field>

        <Field label="Confirm password" required error={errors.confirm_password?.message}>
          <TextInput
            type="password"
            autoComplete="new-password"
            {...register('confirm_password')}
          />
        </Field>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
