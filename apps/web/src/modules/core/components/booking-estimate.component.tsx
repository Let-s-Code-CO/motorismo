'use client';

import { useTranslations } from 'next-intl';

import { Clock } from 'lucide-react';

import useDuration from '@web/modules/core/hooks/duration.hook';
import { orderEstimate } from '@web/modules/work-orders/utils/order-estimate.utils';

type BookingEstimateProps = {
  /** The services ticked (only those offered for the chosen vehicle), with their times. */
  services: readonly { name: string; estimated_minutes: number | null }[];
};

/**
 * How long what is being booked will take (spec 021, HU-02; staff too, spec 024, CA-14): the sum of the services'
 * times, as staff write it («Tiempo estimado: ≈ 2 h 15 min», CA-06), naming those without a time
 * (CA-07); nothing while none is ticked (CA-08). Only shown: it books no more slots (RN-02).
 * A polite live region that is always there, so each change is heard without interrupting. It has no
 * role of its own: the form already has a status (a closed day).
 */
const BookingEstimate = ({ services }: BookingEstimateProps) => {
  const t = useTranslations('core.estimate');
  const duration = useDuration();
  const estimate = orderEstimate(services, null);

  return (
    <div data-booking-estimate aria-live="polite" className="flex flex-col gap-0.5 text-sm">
      {services.length > 0 &&
        (estimate.kind === 'none' ? (
          <span className="text-default-500">{t('none')}</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5">
              <Clock aria-hidden className="size-4 text-default-400" />
              {t('total', { duration: duration(estimate.minutes) })}
            </span>
            {estimate.kind === 'minimum' && (
              <span className="text-xs text-default-500">
                {t('missing', { names: estimate.missing.join(', ') })}
              </span>
            )}
          </>
        ))}
    </div>
  );
};

export default BookingEstimate;
