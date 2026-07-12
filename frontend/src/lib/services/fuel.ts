import { apiFetch } from '../api';

export interface FuelLog {
  id: string;
  vehicle_id: string;
  trip_id: string | null;
  liters: number;
  cost: number;
  odometer: number | null;
  filled_at: string; // YYYY-MM-DD
  price_per_liter: number | null;
  registration_number: string;
  model: string;
  vehicle_type: string;
}

export interface FuelPayload {
  vehicle_id: string;
  liters: number;
  cost: number;
  odometer?: number;
  filled_at?: string;
}

export type Trend = 'improving' | 'degrading' | 'stable';

export interface VehicleFuelStat {
  vehicle_id: string;
  registration_number: string;
  model: string;
  vehicle_type: string;
  fills: number;
  total_liters: number;
  fuel_cost: number;
  maintenance_cost: number;
  other_expenses: number;
  operational_cost: number;
  distance_km: number;
  cost_per_km: number | null;
  avg_price_per_liter: number;
  efficiency: number | null;
  trend: Trend;
  trend_pct: number;
  anomaly: boolean;
}

export interface FuelAlert {
  vehicle_id: string;
  registration: string;
  severity: 'warning' | 'serious';
  message: string;
}

export interface MonthPoint {
  period: string;
  actual: number | null;
  forecast: number | null;
}

export interface FuelForecast {
  next_period: string;
  next_period_cost: number;
  slope: number;
  trend: 'rising' | 'falling' | 'stable';
  method: string;
}

export interface CompositionSlice {
  label: string;
  amount: number;
  pct: number;
}

export interface ExpenseSlice {
  type: string;
  amount: number;
  pct: number;
}

export interface FuelAnalytics {
  fleet: {
    total_liters: number;
    total_cost: number;
    avg_price_per_liter: number;
    fleet_efficiency: number | null;
    maintenance_cost: number;
    other_expenses: number;
    operational_cost: number;
    total_distance: number;
    avg_cost_per_km: number | null;
    log_count: number;
    vehicle_count: number;
  };
  vehicles: VehicleFuelStat[];
  alerts: FuelAlert[];
  monthly: MonthPoint[];
  forecast: FuelForecast | null;
  cost_composition: CompositionSlice[];
  expense_breakdown: ExpenseSlice[];
}

export const fuelApi = {
  list: (vehicleId?: string) =>
    apiFetch<{ logs: FuelLog[] }>(`/api/fuel${vehicleId ? `?vehicle_id=${vehicleId}` : ''}`),

  create: (payload: FuelPayload) =>
    apiFetch<{ log: FuelLog }>('/api/fuel', { method: 'POST', body: JSON.stringify(payload) }),

  remove: (id: string) =>
    apiFetch<{ message: string }>(`/api/fuel/${id}`, { method: 'DELETE' }),

  analytics: () => apiFetch<FuelAnalytics>('/api/fuel/analytics'),
};
