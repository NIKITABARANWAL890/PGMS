import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'

import authReducer from '@/features/auth/authSlice'
import pgReducer from '@/features/properties/selectedPgSlice'
import { apiSlice } from '@/services/api/apiSlice'

/**
 * Two plain slices and one RTK Query cache.
 *
 * `auth` and `selectedPg` are genuine client state — nothing on the server
 * knows which PG this browser tab is looking at. Everything else is server
 * data and belongs to RTK Query, not to a hand-written slice.
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    selectedPg: pgReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
