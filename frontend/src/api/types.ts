export type SizeClass = 'S' | 'M' | 'L'
export type BuoyStatus = 'available' | 'occupied' | 'maintenance'
export type WaitlistStatus = 'waiting' | 'placed' | 'withdrawn'

export interface StaffUser {
  id: number
  email: string
  username: string
  full_name: string
  role: string
}

export interface Bay {
  id: number
  name: string
  description: string
  buoy_count: number
  waiting_count: number
}

export interface Buoy {
  id: number
  bay_id: number
  bay_name: string
  code: string
  size_class: SizeClass
  depth_m: number
  swing_radius_m: number
  status: BuoyStatus
  notes: string
  last_inspected_on: string | null
  next_inspection_due: string | null
  inspection_count: number
  chain_wear_percent: number | null
  updated_at: string
}

export interface BuoyInput {
  bay_id: number
  code: string
  size_class: SizeClass
  depth_m: number
  swing_radius_m: number
  status: BuoyStatus
  notes: string
}

export interface WaitlistEntry {
  id: number
  owner_name: string
  owner_email: string
  owner_phone: string
  boat_name: string
  boat_length_m: number
  size_class: SizeClass
  joined_on: string
  status: WaitlistStatus
  notes: string
  position: number | null
  days_waiting: number
  updated_at: string
}

export interface WaitlistInput {
  owner_name: string
  owner_email: string
  owner_phone: string
  boat_name: string
  boat_length_m: number
  size_class: SizeClass
  joined_on: string
  status: WaitlistStatus
  notes: string
}

export interface Inspection {
  id: number
  buoy_id: number
  buoy_code: string
  bay_name: string
  inspected_on: string
  inspector_name: string
  chain_wear_percent: number
  attention: boolean
  notes: string
  updated_at: string
}

export interface InspectionInput {
  buoy_id: number
  inspected_on: string
  inspector_name: string
  chain_wear_percent: number
  notes: string
}

export interface OverdueBuoy {
  id: number
  code: string
  bay_name: string
  size_class: SizeClass
  last_inspected_on: string | null
  days_overdue: number | null
}

export interface LongestWaiting {
  id: number
  owner_name: string
  boat_name: string
  size_class: SizeClass
  joined_on: string
  days_waiting: number
}

export interface Overview {
  bay_count: number
  buoy_count: number
  buoys_available: number
  buoys_occupied: number
  buoys_maintenance: number
  owners_waiting: number
  waiting_by_size: Record<string, number>
  overdue_inspections: OverdueBuoy[]
  longest_waiting: LongestWaiting[]
  inspections_this_year: number
}
