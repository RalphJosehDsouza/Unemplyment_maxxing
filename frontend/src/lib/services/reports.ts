import { apiFetch } from '../api';

export interface VehicleReport {
  vehicle_id: string;
  registration_number: string;
  model: string;
  vehicle_type: string;
  status: string;
  acquisition_cost: number;
  trips_completed: number;
  revenue: number;
  fuel_cost: number;
  maintenance_cost: number;
  other_expenses: number;
  operating_cost: number;
  profit: number;
  roi_pct: number | null;
  efficiency: number | null;
}

export interface ReportsAnalytics {
  fleet: {
    total_revenue: number;
    total_operating_cost: number;
    total_profit: number;
    fleet_roi_pct: number | null;
    utilization_pct: number;
    avg_efficiency: number | null;
    total_acquisition: number;
    counts: Record<string, number>;
    vehicle_count: number;
  };
  vehicles: VehicleReport[];
}

export const reportsApi = {
  analytics: () => apiFetch<ReportsAnalytics>('/api/reports/analytics'),
};
