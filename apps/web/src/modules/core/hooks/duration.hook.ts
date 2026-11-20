'use client';

import { useCallback } from 'react';

import { useTranslations } from 'next-intl';

/** How long something takes, as staff read it: «45 min», «2 h», «2 h 30 min» (spec 008, HU-06). */
const useDuration = () => {
  const t = useTranslations('core.duration');

  return useCallback(
    (total: number) => {
      const hours = Math.floor(total / 60);
      const minutes = total % 60;
      if (!hours) return t('minutes', { minutes });
      if (!minutes) return t('hours', { hours });
      return t('hoursMinutes', { hours, minutes });
    },
    [t]
  );
};

export default useDuration;
