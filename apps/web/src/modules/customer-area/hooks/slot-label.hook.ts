'use client';

import { useCallback } from 'react';

import { useFormatter, useTranslations } from 'next-intl';

import useClock from '@web/modules/core/hooks/clock.hook';

/**
 * «viernes, 13 de junio, 10:00 a. m. – 11:00 a. m.»: a reservation's slot as the customer reads it
 * (spec 014). Date and time apart, as everywhere in the app (the time with `useClock`).
 */
const useSlotLabel = () => {
  const t = useTranslations('customerArea.reservations');
  const format = useFormatter();
  const clock = useClock();
  return useCallback(
    (start: string, end: string) =>
      t('slot', {
        day: format.dateTime(new Date(start), { weekday: 'long', day: 'numeric', month: 'long' }),
        start: clock(new Date(start)),
        end: clock(new Date(end)),
      }),
    [t, format, clock]
  );
};

export default useSlotLabel;
