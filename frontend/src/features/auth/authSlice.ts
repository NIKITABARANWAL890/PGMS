import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { CurrentUser, TokenPair } from '@/types/api'

import {
  clearStoredRefreshToken,
  readStoredRefreshToken,
  storeRefreshToken,
} from './tokenStorage'

interface AuthState {
  accessToken: string | null
  user: CurrentUser | null
  /** True until the first /auth/me resolves, so the router does not bounce a
   *  reloading user to /login before their session has been re-established. */
  bootstrapping: boolean
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
  bootstrapping: readStoredRefreshToken() !== null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionStarted(state, action: PayloadAction<TokenPair>) {
      state.accessToken = action.payload.access_token
      storeRefreshToken(action.payload.refresh_token)
      state.bootstrapping = false
    },
    sessionRefreshed(state, action: PayloadAction<TokenPair>) {
      state.accessToken = action.payload.access_token
      // The backend rotates refresh tokens, so the old one is already dead.
      storeRefreshToken(action.payload.refresh_token)
    },
    userLoaded(state, action: PayloadAction<CurrentUser>) {
      state.user = action.payload
      state.bootstrapping = false
    },
    clearSession(state) {
      state.accessToken = null
      state.user = null
      state.bootstrapping = false
      clearStoredRefreshToken()
    },
    bootstrapFinished(state) {
      state.bootstrapping = false
    },
  },
})

export const {
  bootstrapFinished,
  clearSession,
  sessionRefreshed,
  sessionStarted,
  userLoaded,
} = authSlice.actions

export default authSlice.reducer
