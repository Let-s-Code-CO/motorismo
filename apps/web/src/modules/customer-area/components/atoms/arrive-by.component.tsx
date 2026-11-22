'use client';

import { useNow, useTranslations } from 'next-intl';

import useClock from '@web/modules/core/hooks/clock.hook';

/**
 * Until when the customer may arrive to keep their turn (spec 014, CA-17); once that time has passed,
 * that it has, and that they would go by arrival (CA-23), never a time in the past. The screen keeps
 * time: it changes by itself when the time passes.
 */
const ArriveBy = ({ graceUntil, className }: { graceUntil: string; className?: string }) => {
  const t = useTranslations('customerArea.reservations');
  const clock = useClock();
  const now = useNow({ updateInterval: 30_000 });
  const grace = new Date(graceUntil);

  return (
    <p className={className}>
      {grace.getTime() < now.getTime() ? t('graceOver') : t('arriveBy', { time: clock(grace) })}
    </p>
  );
};

export default ArriveBy;
