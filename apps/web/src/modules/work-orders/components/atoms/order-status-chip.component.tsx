'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';

import type { WorkOrderStatus } from '@web/modules/work-orders/types/work-orders.types';

const COLOR = { open: 'warning', closed: 'success', voided: 'default' } as const;

/** «En el lavadero», «Cerrada» or «Anulada» (spec 008, RF-03). */
const OrderStatusChip = ({ status }: { status: WorkOrderStatus }) => {
  const t = useTranslations('orders.status');

  return (
    <Chip size="sm" variant="dot" color={COLOR[status]}>
      {t(status)}
    </Chip>
  );
};

export default OrderStatusChip;
