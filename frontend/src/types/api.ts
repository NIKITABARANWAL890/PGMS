/**
 * Shapes returned by the Phase 1 API.
 *
 * Only Phase 1 resources appear here. Tenants, bills, complaints and move-outs
 * arrive in Phases 2-6 and are deliberately absent rather than stubbed.
 */

export type UserRole = 'owner' | 'staff' | 'tenant'
export type BedStatus = 'occupied' | 'vacant' | 'maintenance'
export type RoomType = 'single' | 'double' | 'triple' | 'sharing'

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

export interface RoomWithBeds {
  id: string
  floor_id: string
  room_number: string
  room_type: RoomType
  total_beds: number
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
}

export interface Floor {
  id: string
  building_id: string
  floor_label: string
  floor_order: number
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
