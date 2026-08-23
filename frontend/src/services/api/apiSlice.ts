import { createApi } from '@reduxjs/toolkit/query/react'

import { baseQueryWithReauth } from './baseQuery'

/**
 * The single RTK Query API. Feature slices inject their endpoints into this
 * one instance (see features/*\/*Api.ts) rather than creating their own, so
 * cache tags invalidate across features — creating a bed has to be able to
 * refresh the Properties table's bed counts.
 */
export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['PG', 'PGRooms', 'Staff', 'CurrentUser'],
  endpoints: () => ({}),
})
