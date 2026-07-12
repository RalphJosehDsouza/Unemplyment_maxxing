import { apiFetch } from '../api';

export interface VehicleRec {
  id: string;
  registration_number: string;
  model: string;
  vehicle_type: string;
  capacity: number;
  capacity_utilization: number;
  cost_per_km: number | null;
  score: number;
  reasons: string[];
}

export interface DriverRec {
  id: string;
  name: string;
  license_number: string;
  license_category: string | null;
  license_expiry: string;
  days_to_expiry: number;
  safety_score: number;
  score: number;
  reasons: string[];
}

export interface Recommendation {
  cargo: number;
  recommendation: { vehicle: VehicleRec; driver: DriverRec } | null;
  vehicles: VehicleRec[];
  drivers: DriverRec[];
  excluded: {
    available_vehicles_too_small: number;
    available_drivers_expired: number;
  };
}

export const advisorApi = {
  recommend: (cargo: number) => apiFetch<Recommendation>(`/api/advisor/recommend?cargo=${cargo}`),
};
