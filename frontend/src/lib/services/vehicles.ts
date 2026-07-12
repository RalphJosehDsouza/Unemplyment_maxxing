import { apiFetch } from '../api';
import { Vehicle } from '../constants';

export interface VehiclePayload {
  registration_number: string;
  model: string;
  vehicle_type: string;
  max_load_capacity: number;
  current_odometer?: number;
  acquisition_cost?: number;
  status?: string;
}

export interface VehicleFilters {
  status?: string;
  type?: string;
  search?: string;
}

function toQuery(filters: VehicleFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.append(k, v);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const vehiclesApi = {
  list: (filters?: VehicleFilters) =>
    apiFetch<{ vehicles: Vehicle[] }>(`/api/vehicles${toQuery(filters)}`),

  get: (id: string) => apiFetch<{ vehicle: Vehicle }>(`/api/vehicles/${id}`),

  create: (payload: VehiclePayload) =>
    apiFetch<{ vehicle: Vehicle }>('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: Partial<VehiclePayload>) =>
    apiFetch<{ vehicle: Vehicle }>(`/api/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    apiFetch<{ message: string }>(`/api/vehicles/${id}`, { method: 'DELETE' }),
};
