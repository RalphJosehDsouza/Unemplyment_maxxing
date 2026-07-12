import { apiFetch } from '../api';

export const EXPENSE_TYPES = ['TOLL', 'MAINTENANCE', 'PARKING', 'INSURANCE', 'OTHER'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number] | 'FUEL';

export const EXPENSE_TYPE_COLORS: Record<string, string> = {
  FUEL: '#3b82f6',
  MAINTENANCE: '#f59e0b',
  TOLL: '#8b5cf6',
  PARKING: '#10b981',
  INSURANCE: '#ec4899',
  OTHER: '#64748b',
};

export interface Expense {
  id: string;
  vehicle_id: string;
  trip_id: string | null;
  expense_type: ExpenseType;
  amount: number;
  description: string | null;
  expense_date: string; // YYYY-MM-DD
  registration_number: string;
  model: string;
}

export interface ExpensePayload {
  vehicle_id: string;
  expense_type: string;
  amount: number;
  description?: string;
  expense_date?: string;
}

export const expensesApi = {
  list: (vehicleId?: string) =>
    apiFetch<{ expenses: Expense[] }>(`/api/expenses${vehicleId ? `?vehicle_id=${vehicleId}` : ''}`),

  create: (payload: ExpensePayload) =>
    apiFetch<{ expense: Expense }>('/api/expenses', { method: 'POST', body: JSON.stringify(payload) }),

  remove: (id: string) =>
    apiFetch<{ message: string }>(`/api/expenses/${id}`, { method: 'DELETE' }),
};
