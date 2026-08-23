import { configureStore } from '@reduxjs/toolkit'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'

import authReducer from '@/features/auth/authSlice'
import selectedPgReducer from '@/features/properties/selectedPgSlice'
import { apiSlice } from '@/services/api/apiSlice'

/**
 * Render a component with a fresh store and router.
 *
 * A new store per test matters: the auth slice and the RTK Query cache are both
 * stateful, so a shared store would let one test's session leak into the next.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: { route?: string } = {},
) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      selectedPg: selectedPgReducer,
      [apiSlice.reducerPath]: apiSlice.reducer,
    },
    middleware: (getDefault) => getDefault().concat(apiSlice.middleware),
  })

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </Provider>,
    ),
  }
}
