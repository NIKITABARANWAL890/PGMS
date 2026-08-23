import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query'
import { Mutex } from 'async-mutex'

import type { RootState } from '@/app/store'
import { clearSession, sessionRefreshed } from '@/features/auth/authSlice'
import { readStoredRefreshToken } from '@/features/auth/tokenStorage'
import type { TokenPair } from '@/types/api'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

// Without this, several requests failing 401 at once would each start their own
// refresh. The first refresh rotates the token, so the rest would present a
// token that has just been revoked and log the user out mid-session.
const refreshMutex = new Mutex()

/**
 * Attaches the access token, and on a 401 tries exactly one refresh before
 * replaying the original request. A second 401 ends the session.
 */
export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await refreshMutex.waitForUnlock()
  let result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status !== 401) return result

  const refreshToken = readStoredRefreshToken()
  if (!refreshToken) {
    api.dispatch(clearSession())
    return result
  }

  if (refreshMutex.isLocked()) {
    // Another request is already refreshing — wait for it, then retry once.
    await refreshMutex.waitForUnlock()
    return rawBaseQuery(args, api, extraOptions)
  }

  const release = await refreshMutex.acquire()
  try {
    const refreshResult = await rawBaseQuery(
      {
        url: '/auth/refresh',
        method: 'POST',
        body: { refresh_token: refreshToken },
      },
      api,
      extraOptions,
    )

    if (refreshResult.data) {
      api.dispatch(sessionRefreshed(refreshResult.data as TokenPair))
      result = await rawBaseQuery(args, api, extraOptions)
    } else {
      api.dispatch(clearSession())
    }
  } finally {
    release()
  }

  return result
}
