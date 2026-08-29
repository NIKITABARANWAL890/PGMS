/**
 * Shapes returned by the Phase 1 API.
 *
 * Only Phase 1 resources appear here. Tenants, bills, complaints and move-outs
 * arrive in Phases 2-6 and are deliberately absent rather than stubbed.
 */

export type UserRole = 'owner' | 'staff' | 'tenant'
export type BedStatus = 'occupied' | 'vacant' | 'maintenance'
export type RoomType = 'single' | 'double' | 'triple' | 'sharing'
/** Owner UI guide 3.1 — Girls / Boys / Co-living. */
export type PGType = 'girls' | 'boys' | 'co_living'

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface CurrentUser {
  id: string
  role: UserRole
  full_name: string
  email: string | null
  phone: string
  staff_title: string | null
  is_active: boolean
}

export interface PG {
  id: string
  name: string
  address: string
  /** Null on PGs created before these fields existed — the Details tab prompts. */
  pg_type: PGType | null
  city: string | null
  state: string | null
  pincode: string | null
  contact_phone: string | null
  contact_email: string | null
  pg_code: string | null
  description: string | null
  created_at: string
}

export interface PGSummary extends PG {
  total_beds: number
  occupied_beds: number
  vacant_beds: number
  maintenance_beds: number
}

export interface Bed {
  id: string
  room_id: string
  bed_label: string
  status: BedStatus
  monthly_rent: string | null
}

export interface Room {
  id: string
  floor_id: string
  room_number: string
  room_type: RoomType
  total_beds: number
  monthly_rent: string | null
  description: string | null
}

export interface RoomWithBeds extends Room {
  floor_label: string
  building_name: string
  beds: Bed[]
  occupied_beds: number
  vacant_beds: number
  maintenance_beds: number
}

export interface PGRooms {
  pg_id: string
  pg_name: string
  total_beds: number
  occupied_beds: number
  vacant_beds: number
  maintenance_beds: number
  rooms: RoomWithBeds[]
}

export interface Building {
  id: string
  pg_id: string
  name: string
  building_code: string | null
}

/** Buildings & Floors tab (guide 7): a building with its roll-up. */
export interface BuildingWithStructure extends Building {
  floor_count: number
  room_count: number
  bed_count: number
  occupied_beds: number
}

export interface Floor {
  id: string
  building_id: string
  floor_label: string
  floor_order: number
}

/** Floors Overview (guide 3.4): a floor with zero rooms reads "Not Configured". */
export interface FloorOverview extends Floor {
  room_count: number
  bed_count: number
  occupied_beds: number
  monthly_rent_total: string
}

export interface FloorWithBuilding extends Floor {
  /** Carried so a floor stays unambiguous once a PG has more than one building. */
  building_name: string
  room_count: number
}

export interface StaffMember {
  id: string
  full_name: string
  email: string | null
  phone: string
  /** Display label only ("Manager", "Housekeeping") — never a permission tier. */
  staff_title: string | null
  is_active: boolean
  assigned_pgs: PG[]
}

export interface StaffCreated extends StaffMember {
  /** Shown once, immediately after creation. Never retrievable again. */
  temporary_password: string
}
