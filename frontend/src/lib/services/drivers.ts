import { apiFetch } from '../api';

export const DRIVER_STATUSES = ['AVAILABLE', 'ON_TRIP', 'OFF_DUTY', 'SUSPENDED'] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export interface Driver {
  id: string;
  name: string;
  license_number: string;
  license_category: string | null;
  license_expiry: string; // YYYY-MM-DD
  contact_number: string | null;
  safety_score: number;
  status: DriverStatus;
  license_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface DriverPayload {
  name: string;
  license_number: string;
  license_category?: string;
  license_expiry: string; // YYYY-MM-DD
  contact_number?: string;
  safety_score?: number;
  status?: string;
}

export interface DriverFilters {
  status?: string;
  search?: string;
  expiring?: boolean;
}

function toQuery(filters: DriverFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  if (filters.expiring) params.append('expiring', 'true');
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const driversApi = {
  list: (filters?: DriverFilters) =>
    apiFetch<{ drivers: Driver[] }>(`/api/drivers${toQuery(filters)}`),

  get: (id: string) => apiFetch<{ driver: Driver }>(`/api/drivers/${id}`),

  create: (payload: DriverPayload) =>
    apiFetch<{ driver: Driver }>('/api/drivers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: Partial<DriverPayload>) =>
    apiFetch<{ driver: Driver }>(`/api/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  remove: (id: string) =>
    apiFetch<{ message: string }>(`/api/drivers/${id}`, { method: 'DELETE' }),
};
