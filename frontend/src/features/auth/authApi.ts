import { apiSlice } from '@/services/api/apiSlice'
import type { CurrentUser, TokenPair } from '@/types/api'

import { clearSession, sessionStarted, userLoaded } from './authSlice'
import { readStoredRefreshToken } from './tokenStorage'

interface RegisterBody {
  full_name: string
  phone: string
  email: string
  password: string
}

interface LoginBody {
  email: string
  password: string
}

export const authApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    register: builder.mutation<TokenPair, RegisterBody>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // The try/catch is required, not defensive: an onQueryStarted that
        // lets queryFulfilled reject produces an unhandled promise rejection.
        // The component already surfaces the failure via the hook's `error`.
        try {
          const { data } = await queryFulfilled
          dispatch(sessionStarted(data))
        } catch {
          /* reported to the user by the form */
        }
      },
    }),

    login: builder.mutation<TokenPair, LoginBody>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(sessionStarted(data))
        } catch {
          /* reported to the user by the form */
        }
      },
    }),

    currentUser: builder.query<CurrentUser, void>({
      query: () => '/auth/me',
      providesTags: ['CurrentUser'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(userLoaded(data))
        } catch {
          // Refresh already had its chance in baseQuery; this is a dead session.
          dispatch(clearSession())
        }
      },
    }),

    updateProfile: builder.mutation<
      CurrentUser,
      { full_name?: string; email?: string; phone?: string }
    >({
      query: (body) => ({ url: '/auth/me', method: 'PATCH', body }),
      invalidatesTags: ['CurrentUser'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          // Keep the header's name/email in step with the edit immediately,
          // rather than waiting for the refetch to land.
          dispatch(userLoaded(data))
        } catch {
          /* reported by the form */
        }
      },
    }),

    changePassword: builder.mutation<
      void,
      { current_password: string; new_password: string }
    >({
      query: (body) => ({ url: '/auth/change-password', method: 'POST', body }),
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
        body: { refresh_token: readStoredRefreshToken() ?? '' },
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        // Clear locally regardless: if the revoke call fails, the user still
        // expects to be signed out on this device.
        try {
          await queryFulfilled
        } finally {
          dispatch(clearSession())
          dispatch(apiSlice.util.resetApiState())
        }
      },
    }),
  }),
})

export const {
  useChangePasswordMutation,
  useUpdateProfileMutation,
  useCurrentUserQuery,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
} = authApi
