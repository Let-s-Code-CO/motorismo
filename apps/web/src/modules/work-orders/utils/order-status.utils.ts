import type { WorkOrderStatus } from '@web/modules/work-orders/types/work-orders.types';

/** Where an order is in the car wash (spec 008, HU-07). */
export type OrderStage = 'queued' | 'in_progress' | 'closed' | 'voided';

/**
 * An open order waits «En cola» until it is started, then it is «En proceso» (CA-32, CA-33,
 * RN-12); closed and voided orders stay what they are, started or not (CA-35).
 */
export const orderStage = (order: {
  status: WorkOrderStatus | null;
  started_at: string | null;
}): OrderStage => {
  if (order.status === 'closed') return 'closed';
  if (order.status === 'voided') return 'voided';
  return order.started_at ? 'in_progress' : 'queued';
};
