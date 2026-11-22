import type { ReactElement, ReactNode } from 'react';

import { NextIntlClientProvider } from 'next-intl';

import { HeroUIProvider } from '@heroui/react';
import { type RenderOptions, render, screen, within } from '@testing-library/react';

import { DEFAULT_LOCALE, TIME_ZONE, messages } from '@web/i18n/messages';
import { ToastStack } from '@web/modules/core/components/toast-region.component';

/**
 * Renders with the same providers the app uses and the REAL Spanish messages, so assertions read
 * the text a user sees and a missing translation key fails the test. The floating notices (spec
 * 013) are there too, as in the root layout: a screen's confirmation is found where the person
 * sees it, in the region «Avisos».
 */
const providers = (toasts: boolean) => {
  const AllProviders = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale={DEFAULT_LOCALE} timeZone={TIME_ZONE} messages={messages}>
      <HeroUIProvider locale={DEFAULT_LOCALE}>
        {children}
        {toasts && <ToastStack />}
      </HeroUIProvider>
    </NextIntlClientProvider>
  );
  return AllProviders;
};

/** `toasts: false` leaves the notices out: for the tests of the notices themselves. */
export const renderWithProviders = (
  ui: ReactElement,
  { toasts = true, ...options }: RenderOptions & { toasts?: boolean } = {}
) => render(ui, { wrapper: providers(toasts), ...options });

/** The floating notices (spec 013): where a screen's confirmation or standalone error shows. */
export const inToasts = () => within(screen.getByRole('region', { name: 'Avisos' }));
