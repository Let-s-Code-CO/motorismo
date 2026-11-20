import type { ReactNode } from 'react';

import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Geist } from 'next/font/google';

import AppProvider from '@web/modules/core/providers/app.provider';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations('core.metadata');

  const brand = await getTranslations('core.brand');

  return {
    title: t('title'),
    description: t('description'),
    // Added to the iPhone/iPad home screen, it opens full screen with its short name (spec 006,
    // CA-04). The default status bar keeps content clear of the notch without viewport-fit=cover.
    appleWebApp: { capable: true, title: brand('short'), statusBarStyle: 'default' },
  };
};

/** The app's background (hero.ts), also in the manifest: the system bar blends in (CA-05). */
export const viewport: Viewport = { themeColor: '#fafafa' };

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const locale = await getLocale();

  return (
    <html lang={locale} className={geist.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <AppProvider>{children}</AppProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
