'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';

import type { OrderStage } from '@web/modules/work-orders/utils/order-status.utils';

/** State colours (CLAUDE.md): waiting grey, in progress amber, done green, voided grey. */
const COLOR = {
  queued: 'default',
  in_progress: 'warning',
  closed: 'success',
  voided: 'default',
} as const;

/** «En cola», «En proceso», «Cerrada» or «Anulada» (spec 008, RF-03, HU-07). */
const OrderStatusChip = ({ stage }: { stage: OrderStage }) => {
  const t = useTranslations('orders.status');

  return (
    <Chip size="sm" variant="dot" color={COLOR[stage]}>
      {t(stage)}
    </Chip>
  );
};

export default OrderStatusChip;
