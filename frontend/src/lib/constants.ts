// Shared enums and display metadata mirroring the backend / DB schema.

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  FLEET_MANAGER: 'Fleet Manager',
  SAFETY_OFFICER: 'Safety Officer',
  FINANCIAL_ANALYST: 'Financial Analyst',
};

export const VEHICLE_STATUSES = ['AVAILABLE', 'ON_TRIP', 'IN_SHOP', 'RETIRED'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

// Badge palette per the design system (README status table).
export const STATUS_STYLES: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  AVAILABLE: { bg: 'rgba(16,185,129,0.12)', fg: '#10b981', border: 'rgba(16,185,129,0.25)', label: 'Available' },
  ON_TRIP:   { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6', border: 'rgba(59,130,246,0.25)', label: 'On Trip' },
  IN_SHOP:   { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b', border: 'rgba(245,158,11,0.25)', label: 'In Shop' },
  RETIRED:   { bg: 'rgba(100,116,139,0.12)', fg: '#64748b', border: 'rgba(100,116,139,0.25)', label: 'Retired' },
  SUSPENDED: { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444', border: 'rgba(239,68,68,0.25)', label: 'Suspended' },
  OFF_DUTY:  { bg: 'rgba(107,114,128,0.12)', fg: '#9ca3af', border: 'rgba(107,114,128,0.25)', label: 'Off Duty' },
};

export interface Vehicle {
  id: string;
  registration_number: string;
  model: string;
  vehicle_type: string;
  max_load_capacity: number;
  current_odometer: number;
  acquisition_cost: number;
  status: VehicleStatus;
  created_at: string;
  updated_at: string;
}

// ── Trip constants ──────────────────────────────────────────────────────────

export const TRIP_STATUSES = ['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_STATUS_STYLES: Record<TripStatus, { bg: string; fg: string; border: string; label: string }> = {
  DRAFT:      { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b', border: 'rgba(245,158,11,0.25)', label: 'Draft' },
  DISPATCHED: { bg: 'rgba(59,130,246,0.12)',  fg: '#3b82f6', border: 'rgba(59,130,246,0.25)', label: 'Dispatched' },
  COMPLETED:  { bg: 'rgba(16,185,129,0.12)',  fg: '#10b981', border: 'rgba(16,185,129,0.25)', label: 'Completed' },
  CANCELLED:  { bg: 'rgba(239,68,68,0.12)',   fg: '#ef4444', border: 'rgba(239,68,68,0.25)',  label: 'Cancelled' },
};

export interface Trip {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  created_by: string | null;
  source: string;
  destination: string;
  cargo_weight: number;
  planned_distance: number;
  actual_distance: number | null;
  start_odometer: number | null;
  end_odometer: number | null;
  fuel_used: number | null;
  revenue: number;
  status: TripStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  vehicle_registration?: string;
  vehicle_model?: string;
  vehicle_capacity?: number;
  driver_name?: string;
  driver_contact?: string;
  created_by_name?: string;
}

export interface AvailableVehicle {
  id: string;
  registration_number: string;
  model: string;
  vehicle_type: string;
  max_load_capacity: number;
  current_odometer: number;
}

export interface AvailableDriver {
  id: string;
  name: string;
  license_number: string;
  license_category: string | null;
  license_expiry: string;
  contact_number: string | null;
  safety_score: number;
}
