'use client';

import { useTranslations } from 'next-intl';

import { Clock } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import useDuration from '@web/modules/core/hooks/duration.hook';
import { orderEstimate } from '@web/modules/work-orders/utils/order-estimate.utils';

type OrderEstimateProps = {
  lines: readonly { name: string; estimated_minutes: number | null }[];
  /** When the order was started; null while it waits in the queue (or is being opened). */
  startedAt: Date | null;
  /** «Lista hacia las …» in a list; the summary uses the longer wording. */
  compact?: boolean;
};

/**
 * The estimate of an order (spec 008, HU-06, HU-07): «≈ 2 h 15 min · lista hacia las 4:15 p. m.»
 * when every line has a time, counted from the start (CA-29, CA-34); a minimum, «desde las …»,
 * naming the missing lines (CA-30); only «≈ 2 h 15 min» while not started (RN-12); or «Sin tiempo
 * estimado». Never an exact time it does not know.
 */
const OrderEstimate = ({ lines, startedAt, compact = false }: OrderEstimateProps) => {
  const t = useTranslations('orders');
  const clock = useClock();
  const duration = useDuration();
  const estimate = orderEstimate(lines, startedAt);

  if (estimate.kind === 'none') {
    return <span className="text-xs text-default-500">{t('summary.noEstimate')}</span>;
  }
  const time = estimate.readyAt ? clock(estimate.readyAt) : null;
  const text = !time
    ? t('summary.estimateDuration', { duration: duration(estimate.minutes) })
    : compact
      ? t(estimate.kind === 'complete' ? 'list.readyAt' : 'list.readyFrom', { time })
      : t(estimate.kind === 'complete' ? 'summary.estimateAll' : 'summary.estimatePartial', {
          duration: duration(estimate.minutes),
          time,
        });

  if (compact) return <span className="text-xs text-default-500">{text}</span>;

  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <span className="flex items-center gap-1.5">
        <Clock aria-hidden className="size-4 text-default-400" />
        {text}
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
