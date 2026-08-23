import { apiSlice } from '@/services/api/apiSlice'
import type { StaffCreated, StaffMember } from '@/types/api'

interface CreateStaffBody {
  full_name: string
  phone: string
  email: string
  /** Display label only. There is no permission payload — capability is fixed. */
  staff_title: string | null
  pg_ids: string[]
}

export const staffApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listStaff: builder.query<StaffMember[], void>({
      query: () => '/staff',
      providesTags: ['Staff'],
    }),

    createStaff: builder.mutation<StaffCreated, CreateStaffBody>({
      query: (body) => ({ url: '/staff', method: 'POST', body }),
      invalidatesTags: ['Staff'],
    }),

    updateStaff: builder.mutation<
      StaffMember,
      { id: string; full_name?: string; staff_title?: string; is_active?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `/staff/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Staff'],
    }),

    updateStaffPGs: builder.mutation<StaffMember, { id: string; pg_ids: string[] }>({
      query: ({ id, pg_ids }) => ({
        url: `/staff/${id}/pgs`,
        method: 'PATCH',
        body: { pg_ids },
      }),
      invalidatesTags: ['Staff'],
    }),
  }),
})

export const {
  useCreateStaffMutation,
  useListStaffQuery,
  useUpdateStaffMutation,
  useUpdateStaffPGsMutation,
} = staffApi
