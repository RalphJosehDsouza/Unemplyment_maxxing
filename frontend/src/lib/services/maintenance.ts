import { apiFetch } from '../api';

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  maintenance_type: string;
  description: string;
  cost: number;
  status: 'OPEN' | 'COMPLETED';
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  registration_number?: string;
  vehicle_model?: string;
  vehicle_type?: string;
  vehicle_status?: string;
}

export interface MaintenanceVehicle {
  id: string;
  registration_number: string;
  model: string;
  vehicle_type: string;
  status: string;
}

export interface MaintenanceInsight {
  type: 'success' | 'warning' | 'alert';
  title: string;
  text: string;
}

export interface MaintenanceAnalytics {
  counts: {
    total: number;
    open: number;
    completed: number;
    totalCost: number;
    openCost: number;
    avgCompletedCost: number;
    avgDowntimeDays: number;
  };
  costTrend: { month: string; cost: number; count: number }[];
  frequentVehicles: { registration_number: string; model: string; maintenance_count: number; total_cost: number }[];
  fleetHealth: { status: string; count: number }[];
  healthScore: number;
  insights: MaintenanceInsight[];
}

export interface MaintenanceFilters {
  status?: string;
  vehicle_id?: string;
  search?: string;
}

function toQuery(filters: MaintenanceFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.append(k, v);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const maintenanceApi = {
  list: (filters?: MaintenanceFilters) =>
    apiFetch<{ records: MaintenanceRecord[] }>(`/api/maintenance${toQuery(filters)}`),

  get: (id: string) =>
    apiFetch<{ record: MaintenanceRecord }>(`/api/maintenance/${id}`),

  create: (payload: { vehicle_id: string; maintenance_type: string; description: string; cost?: number }) =>
    apiFetch<{ record: MaintenanceRecord }>('/api/maintenance', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  close: (id: string, cost?: number) =>
    apiFetch<{ record: MaintenanceRecord }>(`/api/maintenance/${id}/close`, {
      method: 'PATCH',
      body: JSON.stringify(cost != null ? { cost } : {}),
    }),

  analytics: () =>
    apiFetch<MaintenanceAnalytics>('/api/maintenance/analytics'),

  vehicles: () =>
    apiFetch<{ vehicles: MaintenanceVehicle[] }>('/api/maintenance/vehicles'),
};
