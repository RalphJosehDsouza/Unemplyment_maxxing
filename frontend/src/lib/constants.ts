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
