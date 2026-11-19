import type { ReactElement, ReactNode } from 'react';

import { NextIntlClientProvider } from 'next-intl';

import { HeroUIProvider } from '@heroui/react';
import { type RenderOptions, render } from '@testing-library/react';

import { DEFAULT_LOCALE, messages } from '@web/i18n/messages';

/**
 * Renders with the same providers the app uses and the REAL Spanish messages, so assertions read
 * the text a user sees and a missing translation key fails the test.
 */
const AllProviders = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={messages}>
    <HeroUIProvider locale={DEFAULT_LOCALE}>{children}</HeroUIProvider>
  </NextIntlClientProvider>
);

export const renderWithProviders = (ui: ReactElement, options?: RenderOptions) =>
  render(ui, { wrapper: AllProviders, ...options });
