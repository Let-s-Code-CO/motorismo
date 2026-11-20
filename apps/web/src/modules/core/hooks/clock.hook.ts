'use client';

import { useCallback } from 'react';

import { useFormatter } from 'next-intl';

/** The special spaces some engines put in «p. m.» (no-break and narrow no-break). */
const ODD_SPACES = /[\u00a0\u202f]/g;

/**
 * A time of day as staff read it in Colombia: «4:15 p. m.» on a 12-hour clock (spec 008). Node and
 * the browser put different invisible spaces in «p. m.», which breaks hydration; plain spaces
 * make the server and the client render the same text.
 */
const useClock = () => {
  const format = useFormatter();

  return useCallback(
    (date: Date) =>
      format
        .dateTime(date, { hour: 'numeric', minute: '2-digit', hourCycle: 'h12' })
        .replace(ODD_SPACES, ' '),
    [format]
  );
};

export default useClock;
