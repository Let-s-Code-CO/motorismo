import type { DataRequestSummary } from '@web/modules/data-rights/types/data-rights.types';

/** A request as the admin's list reads it (spec 017), with defaults and overrides. */
export const buildDataRequest = (
  overrides: Partial<DataRequestSummary> = {}
): DataRequestSummary => ({
  id: 'r1',
  customer_id: 'c1',
  customer_name: 'Camila Cliente',
  customer_has_account: true,
  customer_origin: 'self_signup',
  customer_erased: false,
  kind: 'correction',
  channel: 'app',
  description: 'Mi correo es otro',
  status: 'received',
  received_at: '2026-11-24T15:00:00Z',
  due_on: '2026-12-16',
  created_by: 'u1',
  resolved_by: null,
  resolved_at: null,
  response: null,
  resolved_by_name: null,
  business_days_left: 15,
  overdue: false,
  ...overrides,
});
