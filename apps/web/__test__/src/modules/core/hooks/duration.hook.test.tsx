/**
 * useDuration — how long something takes, as staff read it (spec 008, HU-06).
 *
 * Guards CA-26 / CA-29: «45 min», «2 h», «2 h 30 min»; a day at most (1.440 min = «24 h»).
 */
import type { ReactNode } from 'react';

import { NextIntlClientProvider } from 'next-intl';

import { renderHook } from '@testing-library/react';

import { DEFAULT_LOCALE, TIME_ZONE, messages } from '@web/i18n/messages';
import useDuration from '@web/modules/core/hooks/duration.hook';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale={DEFAULT_LOCALE} timeZone={TIME_ZONE} messages={messages}>
    {children}
  </NextIntlClientProvider>
);

describe('useDuration', () => {
  it.each([
    [45, '45 min'],
    [5, '5 min'],
    [120, '2 h'],
    [150, '2 h 30 min'],
    [1440, '24 h'],
  ])('shows %i minutes as «%s»', (minutes, shown) => {
    const { result } = renderHook(() => useDuration(), { wrapper });

    expect(result.current(minutes)).toBe(shown);
  });
});
