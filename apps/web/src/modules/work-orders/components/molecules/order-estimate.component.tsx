'use client';

import { useTranslations } from 'next-intl';

import { Clock } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import useDuration from '@web/modules/core/hooks/duration.hook';
import { orderEstimate } from '@web/modules/work-orders/utils/order-estimate.utils';

type OrderEstimateProps = {
  lines: readonly { name: string; estimated_minutes: number | null }[];
  receivedAt: Date;
  /** «Lista hacia las …» in a list; the summary uses the longer wording. */
  compact?: boolean;
};

/**
 * The estimate of an order (spec 008, HU-06): «≈ 2 h 15 min · lista hacia las 4:15 p. m.» when every
 * line has a time (CA-29); a minimum, «desde las …», naming the missing lines (CA-30); or «Sin tiempo
 * estimado». Never an exact time it does not know.
 */
const OrderEstimate = ({ lines, receivedAt, compact = false }: OrderEstimateProps) => {
  const t = useTranslations('orders');
  const clock = useClock();
  const duration = useDuration();
  const estimate = orderEstimate(lines, receivedAt);

  if (estimate.kind === 'none') {
    return <span className="text-xs text-default-500">{t('summary.noEstimate')}</span>;
  }
  const time = clock(estimate.readyAt!);

  if (compact) {
    return (
      <span className="text-xs text-default-500">
        {estimate.kind === 'complete' ? t('list.readyAt', { time }) : t('list.readyFrom', { time })}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <span className="flex items-center gap-1.5">
        <Clock aria-hidden className="size-4 text-default-400" />
        {t(estimate.kind === 'complete' ? 'summary.estimateAll' : 'summary.estimatePartial', {
          duration: duration(estimate.minutes),
          time,
        })}
      </span>
      {estimate.kind === 'minimum' && (
        <span className="text-xs text-default-500">
          {t('summary.missing', { names: estimate.missing.join(', ') })}
        </span>
      )}
    </div>
  );
};

export default OrderEstimate;
