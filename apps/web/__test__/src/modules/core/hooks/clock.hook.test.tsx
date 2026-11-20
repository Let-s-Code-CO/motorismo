/**
 * useClock — a time of day as staff read it in Colombia (spec 008, CA-29).
 *
 * Guards: a 12-hour clock in Bogotá time («4:15 p. m.»), with plain spaces only, so the text the
 * server renders is exactly the browser's (some engines use invisible special spaces in «p. m.»,
 * which breaks hydration).
 */
import type { ReactNode } from 'react';

import { NextIntlClientProvider } from 'next-intl';

import { renderHook } from '@testing-library/react';

import { DEFAULT_LOCALE, TIME_ZONE, messages } from '@web/i18n/messages';
import useClock from '@web/modules/core/hooks/clock.hook';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale={DEFAULT_LOCALE} timeZone={TIME_ZONE} messages={messages}>
    {children}
  </NextIntlClientProvider>
);

describe('useClock', () => {
  it('shows 21:15 UTC as «4:15 p. m.» in Bogotá, with plain spaces only', () => {
    const { result } = renderHook(() => useClock(), { wrapper });

    const shown = result.current(new Date('2026-11-20T21:15:00Z'));

    expect(shown).toBe('4:15 p. m.');
    expect(shown).not.toMatch(/[\u00a0\u202f]/);
  });
});
