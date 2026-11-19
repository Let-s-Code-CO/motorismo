import type { ReactNode } from 'react';

import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import AppProvider from '@web/modules/core/providers/app.provider';

import './globals.css';

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('core.metadata');

  return { title: t('title'), description: t('description') };
};

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <AppProvider>{children}</AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
