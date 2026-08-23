import { yupResolver } from '@hookform/resolvers/yup'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import * as yup from 'yup'

import { Button, ErrorNote, Field, TextInput } from '@/components/ui'
import { useAppSelector } from '@/hooks/redux'
import { apiErrorMessage } from '@/utils/format'

import { useLoginMutation } from './authApi'

const schema = yup.object({
  email: yup.string().required('Email is required').email('Enter a valid email'),
  password: yup.string().required('Password is required'),
})

type LoginValues = yup.InferType<typeof schema>

export default function LoginPage() {
  const [login, { isLoading, error }] = useLoginMutation()
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: yupResolver(schema) })

  // One login form for every role — where you land afterwards is decided by the
  // role the server reports, not by which form you filled in.
  if (accessToken) return <Navigate to="/" replace />

  const onSubmit = handleSubmit(async (values) => {
    await login(values).unwrap().catch(() => undefined)
  })

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Owners, managers and staff all sign in here."
      footer={
        <p className="text-sm text-slate-600">
          New owner?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:underline">
            Create an owner account
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <ErrorNote>{apiErrorMessage(error, 'Could not sign in')}</ErrorNote> : null}

        <Field label="Email" required error={errors.email?.message}>
          <TextInput
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...register('email')}
          />
        </Field>

        <Field label="Password" required error={errors.password?.message}>
          <TextInput
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            {...register('password')}
          />
        </Field>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-navy-900 text-lg font-bold text-white">
            PG
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>

        {footer ? <div className="mt-4 text-center">{footer}</div> : null}
      </div>
    </div>
  )
}
