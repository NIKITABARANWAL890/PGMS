import { apiSlice } from '@/services/api/apiSlice'
import type {
  Bed,
  Building,
  BuildingWithStructure,
  Floor,
  FloorOverview,
  FloorWithBuilding,
  PG,
  PGRooms,
  PGSummary,
  PGType,
  Room,
  RoomType,
} from '@/types/api'

/** Body of the PG Details step (Owner UI guide 3.1). */
export interface PGDetailsBody {
  name: string
  pg_type: PGType
  address: string
  city: string
  state: string
  pincode: string
  contact_phone: string
  contact_email?: string | null
  pg_code?: string | null
  description?: string | null
}

export const propertiesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listPGs: builder.query<PGSummary[], void>({
      query: () => '/pgs',
      providesTags: ['PG'],
    }),

    createPG: builder.mutation<PGSummary, PGDetailsBody>({
      query: (body) => ({ url: '/pgs', method: 'POST', body }),
      invalidatesTags: ['PG'],
    }),

    getPG: builder.query<PGSummary, string>({
      query: (pgId) => `/pgs/${pgId}`,
      providesTags: (_result, _error, pgId) => [{ type: 'PG', id: pgId }, 'PG'],
    }),

    updatePG: builder.mutation<PGSummary, { pgId: string } & Partial<PGDetailsBody>>({
      query: ({ pgId, ...body }) => ({ url: `/pgs/${pgId}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PG', id: pgId }, 'PG'],
    }),

    /** Buildings & Floors tab (guide 7) — one row per building, with roll-ups. */
    pgStructure: builder.query<BuildingWithStructure[], string>({
      query: (pgId) => `/pgs/${pgId}/structure`,
      providesTags: (_result, _error, pgId) => [{ type: 'PGRooms', id: pgId }],
    }),

    /** Floors Overview (guide 3.4) — which floors are configured, which are not. */
    floorOverview: builder.query<FloorOverview[], string>({
      query: (pgId) => `/pgs/${pgId}/floor-overview`,
      providesTags: (_result, _error, pgId) => [{ type: 'PGRooms', id: pgId }],
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

    createBuilding: builder.mutation<
      Building,
      { pgId: string; name: string; building_code?: string | null }
    >({
      query: ({ pgId, name, building_code }) => ({
        url: `/pgs/${pgId}/buildings`,
        method: 'POST',
        body: { name, building_code: building_code || null },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    updateBuilding: builder.mutation<
      Building,
      { buildingId: string; pgId: string; name?: string; building_code?: string | null }
    >({
      query: ({ buildingId, name, building_code }) => ({
        url: `/buildings/${buildingId}`,
        method: 'PATCH',
        body: { name, building_code },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    /**
     * Guide 3.3: a floor count in, Floor 1..N out.
     *
     * The setup flow never creates floors one at a time — this is the only way
     * floors are made during setup.
     */
    generateFloors: builder.mutation<Floor[], { buildingId: string; pgId: string; floor_count: number }>({
      query: ({ buildingId, floor_count }) => ({
        url: `/buildings/${buildingId}/floors/generate`,
        method: 'POST',
        body: { floor_count },
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

    listFloorRooms: builder.query<Room[], { floorId: string; pgId: string }>({
      query: ({ floorId }) => `/floors/${floorId}/rooms`,
      providesTags: (_result, _error, { pgId }) => [{ type: 'PGRooms', id: pgId }],
    }),

    createRoom: builder.mutation<
      Room,
      {
        floorId: string
        pgId: string
        room_number: string
        room_type: RoomType
        total_beds: number
        monthly_rent: string
        description?: string | null
        generate_beds?: boolean
      }
    >({
      query: ({ floorId, pgId: _pgId, ...body }) => ({
        url: `/floors/${floorId}/rooms`,
        method: 'POST',
        body,
      }),
      // Bed counts on the Properties screen change too, hence both tags.
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    updateRoom: builder.mutation<
      Room,
      {
        roomId: string
        pgId: string
        room_number?: string
        room_type?: RoomType
        total_beds?: number
        monthly_rent?: string
        description?: string | null
      }
    >({
      query: ({ roomId, pgId: _pgId, ...body }) => ({
        url: `/rooms/${roomId}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    listRoomBeds: builder.query<Bed[], { roomId: string; pgId: string }>({
      query: ({ roomId }) => `/rooms/${roomId}/beds`,
      providesTags: (_result, _error, { pgId }) => [{ type: 'PGRooms', id: pgId }],
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

    /** Guide 3.6's shortcut: a bed count in, Bed A / Bed B / Bed C out. */
    generateBeds: builder.mutation<
      Bed[],
      { roomId: string; pgId: string; bed_count: number; monthly_rent?: string | null }
    >({
      query: ({ roomId, bed_count, monthly_rent }) => ({
        url: `/rooms/${roomId}/beds/generate`,
        method: 'POST',
        body: { bed_count, monthly_rent: monthly_rent || null },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    updateBed: builder.mutation<
      Bed,
      { bedId: string; pgId: string; bed_label?: string; monthly_rent?: string | null }
    >({
      query: ({ bedId, bed_label, monthly_rent }) => ({
        url: `/beds/${bedId}`,
        method: 'PATCH',
        body: { bed_label, monthly_rent },
      }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    deletePG: builder.mutation<void, string>({
      query: (pgId) => ({ url: `/pgs/${pgId}`, method: 'DELETE' }),
      invalidatesTags: ['PG'],
    }),

    deleteBuilding: builder.mutation<void, { buildingId: string; pgId: string }>({
      query: ({ buildingId }) => ({ url: `/buildings/${buildingId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    deleteFloor: builder.mutation<void, { floorId: string; pgId: string }>({
      query: ({ floorId }) => ({ url: `/floors/${floorId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    deleteRoom: builder.mutation<void, { roomId: string; pgId: string }>({
      query: ({ roomId }) => ({ url: `/rooms/${roomId}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, { pgId }) => [{ type: 'PGRooms', id: pgId }, 'PG'],
    }),

    deleteBed: builder.mutation<void, { bedId: string; pgId: string }>({
      query: ({ bedId }) => ({ url: `/beds/${bedId}`, method: 'DELETE' }),
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
  useDeletePGMutation,
  useDeleteBuildingMutation,
  useDeleteFloorMutation,
  useDeleteRoomMutation,
  useDeleteBedMutation,
  useGetPGQuery,
  useUpdatePGMutation,
  usePgStructureQuery,
  useFloorOverviewQuery,
  useListPgFloorsQuery,
  useListFloorRoomsQuery,
  useListRoomBedsQuery,
  useCreateBedMutation,
  useGenerateBedsMutation,
  useUpdateBedMutation,
  useCreateBuildingMutation,
  useUpdateBuildingMutation,
  useCreateFloorMutation,
  useGenerateFloorsMutation,
  useCreatePGMutation,
  useCreateRoomMutation,
  useUpdateRoomMutation,
  useListBuildingsQuery,
  useListMyAssignedPGsQuery,
  useListPGsQuery,
  usePgRoomsQuery,
  useUpdateBedStatusMutation,
} = propertiesApi
