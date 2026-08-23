import { apiSlice } from '@/services/api/apiSlice'
import type {
  Bed,
  Building,
  Floor,
  FloorWithBuilding,
  PG,
  PGRooms,
  PGSummary,
  RoomWithBeds,
} from '@/types/api'

export const propertiesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listPGs: builder.query<PGSummary[], void>({
      query: () => '/pgs',
      providesTags: ['PG'],
    }),

    createPG: builder.mutation<PGSummary, { name: string; address: string }>({
      query: (body) => ({ url: '/pgs', method: 'POST', body }),
      invalidatesTags: ['PG'],
    }),

    getPG: builder.query<PGSummary, string>({
      query: (pgId) => `/pgs/${pgId}`,
      providesTags: (_result, _error, pgId) => [{ type: 'PG', id: pgId }, 'PG'],
    }),

    /** Every floor in a PG, across all buildings — powers the "pick a floor" control. */
    listPgFloors: builder.query<FloorWithBuilding[], string>({
      query: (pgId) => `/pgs/${pgId}/floors`,
      providesTags: (_result, _error, pgId) => [{ type: 'PGRooms', id: pgId }],
    }),

    /** The PGs a staff member is assigned to — the staff-side equivalent of listPGs. */
    listMyAssignedPGs: builder.query<PG[], void>({
      query: () => '/staff/me/pgs',
      providesTags: ['PG'],
    }),

    pgRooms: builder.query<PGRooms, string>({
      query: (pgId) => `/pgs/${pgId}/rooms`,
      providesTags: (_result, _error, pgId) => [{ type: 'PGRooms', id: pgId }],
    }),

    listBuildings: builder.query<Building[], string>({
      query: (pgId) => `/pgs/${pgId}/buildings`,
      providesTags: (_result, _error, pgId) => [{ type: 'PGRooms', id: pgId }],
    }),

    createBuilding: builder.mutation<Building, { pgId: string; name: string }>({
      query: ({ pgId, name }) => ({
        url: `/pgs/${pgId}/buildings`,
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    createFloor: builder.mutation<
      Floor,
      { buildingId: string; pgId: string; floor_label: string; floor_order: number }
    >({
      query: ({ buildingId, floor_label, floor_order }) => ({
        url: `/buildings/${buildingId}/floors`,
        method: 'POST',
        body: { floor_label, floor_order },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }],
    }),

    createRoom: builder.mutation<
      RoomWithBeds,
      {
        floorId: string
        pgId: string
        room_number: string
        room_type: string
        total_beds: number
      }
    >({
      query: ({ floorId, room_number, room_type, total_beds }) => ({
        url: `/floors/${floorId}/rooms`,
        method: 'POST',
        body: { room_number, room_type, total_beds },
      }),
      // Bed counts on the Properties screen change too, hence both tags.
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    createBed: builder.mutation<
      Bed,
      { roomId: string; pgId: string; bed_label: string; monthly_rent?: string | null }
    >({
      query: ({ roomId, bed_label, monthly_rent }) => ({
        url: `/rooms/${roomId}/beds`,
        method: 'POST',
        body: { bed_label, monthly_rent: monthly_rent || null },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    updateBedStatus: builder.mutation<
      Bed,
      { bedId: string; pgId: string; status: 'vacant' | 'maintenance' }
    >({
      query: ({ bedId, status }) => ({
        url: `/beds/${bedId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),
  }),
})

export const {
  useGetPGQuery,
  useListPgFloorsQuery,
  useCreateBedMutation,
  useCreateBuildingMutation,
  useCreateFloorMutation,
  useCreatePGMutation,
  useCreateRoomMutation,
  useListBuildingsQuery,
  useListMyAssignedPGsQuery,
  useListPGsQuery,
  usePgRoomsQuery,
  useUpdateBedStatusMutation,
} = propertiesApi
