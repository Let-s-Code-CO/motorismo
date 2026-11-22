'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';
import { Bike, Car, Motorbike } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import type {
  ShopOrder,
  ShopOrderLine,
} from '@web/modules/customer-area/types/customer-area.types';
import { orderEstimate } from '@web/modules/work-orders/utils/order-estimate.utils';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

const ICONS = { motorcycle: Motorbike, car: Car, bicycle: Bike } as const;

/**
 * One of the customer's vehicles in the shop (spec 014, HU-01): in the queue, how many orders go
 * before it and since when it is there (CA-01); in progress, since when and «Lista hacia…» only when
 * every service has a time (CA-02). Never anything of anyone else (CA-06).
 */
const ShopOrderCard = ({ order }: { order: ShopOrder }) => {
  const t = useTranslations('customerArea');
  const clock = useClock();
  const lines = (order.lines ?? []) as ShopOrderLine[];
  const started = order.started_at ? new Date(order.started_at) : null;
  const estimate = orderEstimate(lines, started);
  const Icon = ICONS[order.vehicle_type as keyof typeof ICONS] ?? Motorbike;

  return (
    <article className="flex flex-col gap-3 rounded-large border border-divider bg-content1 p-5 shadow-small">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-medium bg-default-100 text-default-600">
            <Icon aria-hidden className="size-5" />
          </span>
          <h3 className="min-w-0 font-semibold tracking-tight break-words">
            {vehicleLabel(order, t('vehicle.noPlate'))}
          </h3>
        </div>
        <Chip size="sm" variant="flat" color={started ? 'success' : 'default'}>
          {started ? t('shop.inProgress') : t('shop.queued')}
        </Chip>
      </div>

      {started ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-sm text-default-600">
            {t('shop.startedAt', { time: clock(started) })}
          </p>
          <p className="text-lg font-semibold tracking-tight">
            {estimate.kind === 'complete' && estimate.readyAt
              ? t('shop.readyAt', { time: clock(estimate.readyAt) })
              : t('shop.noEstimate')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-lg font-semibold tracking-tight">
            {t('shop.ahead', { count: order.ahead ?? 0 })}
          </p>
          <p className="text-sm text-default-600">
            {t('shop.since', { time: clock(new Date(order.opened_at)) })}
          </p>
        </div>
      )}

      {lines.length > 0 && (
        <p className="text-sm text-default-500">
          <span className="sr-only">{t('shop.services')}: </span>
          {lines.map((line) => line.name).join(' · ')}
        </p>
      )}
    </article>
  );
};

export default ShopOrderCard;
