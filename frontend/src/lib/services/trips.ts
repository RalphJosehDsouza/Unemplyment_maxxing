import { apiFetch } from '../api';
import { Trip, AvailableVehicle, AvailableDriver } from '../constants';

export interface TripCreatePayload {
  source: string;
  destination: string;
  vehicle_id?: string;
  driver_id?: string;
  cargo_weight?: number;
  planned_distance?: number;
  revenue?: number;
}

export interface TripCompletePayload {
  actual_distance?: number;
  end_odometer?: number;
  fuel_used?: number;
  revenue?: number;
}

export interface TripFilters {
  status?: string;
  search?: string;
}

function toQuery(filters: TripFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.append(k, v);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const tripsApi = {
  /** List all trips with optional filters. */
  list: (filters?: TripFilters) =>
    apiFetch<{ trips: Trip[] }>(`/api/trips${toQuery(filters)}`),

  /** Get a single trip by ID. */
  get: (id: string) =>
    apiFetch<{ trip: Trip }>(`/api/trips/${id}`),

  /** Create a new DRAFT trip. */
  create: (payload: TripCreatePayload) =>
    apiFetch<{ trip: Trip }>('/api/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  /** Dispatch a DRAFT trip → DISPATCHED. */
  dispatch: (id: string) =>
    apiFetch<{ trip: Trip }>(`/api/trips/${id}/dispatch`, { method: 'PATCH' }),

  /** Complete a DISPATCHED trip → COMPLETED. */
  complete: (id: string, payload?: TripCompletePayload) =>
    apiFetch<{ trip: Trip }>(`/api/trips/${id}/complete`, {
      method: 'PATCH',
      body: JSON.stringify(payload || {}),
    }),

  /** Cancel a DRAFT or DISPATCHED trip → CANCELLED. */
  cancel: (id: string) =>
    apiFetch<{ trip: Trip }>(`/api/trips/${id}/cancel`, { method: 'PATCH' }),

  /** Vehicles available for assignment (status=AVAILABLE). */
  availableVehicles: () =>
    apiFetch<{ vehicles: AvailableVehicle[] }>('/api/trips/available-vehicles'),

  /** Drivers available for assignment (status=AVAILABLE, valid license). */
  availableDrivers: () =>
    apiFetch<{ drivers: AvailableDriver[] }>('/api/trips/available-drivers'),
};
