import { apiFetch } from '../api';

export interface ReminderResult {
  sent: boolean;
  count: number;
  recipient?: string;
  preview?: string | null;
  message?: string;
  mailError?: string;
  drivers?: { name: string; license_number: string; license_expiry: string; days_left: number }[];
}

export const notificationsApi = {
  sendLicenseReminders: (withinDays = 30) =>
    apiFetch<ReminderResult>('/api/notifications/license-reminders', {
      method: 'POST',
      body: JSON.stringify({ withinDays }),
    }),
};
