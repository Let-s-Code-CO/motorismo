import type { ReactNode } from 'react';

import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Geist, Geist_Mono } from 'next/font/google';
import { cookies } from 'next/headers';

import Spotlight from '@web/modules/core/components/spotlight.component';
import ToastRegion from '@web/modules/core/components/toast-region.component';
import AppProvider from '@web/modules/core/providers/app.provider';
import { THEME_COLORS, THEME_COOKIE } from '@web/modules/theme/constants/theme.constants';
import { ThemeProvider } from '@web/modules/theme/providers/theme.provider';
import { THEME_SCRIPT } from '@web/modules/theme/utils/theme-script.utils';
import { parseThemeChoice } from '@web/modules/theme/utils/theme.utils';

import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
// Spec 019, CA-04: figures and table headers in the mono face, like a dashboard.
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

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

/** The device's theme choice (spec 010, CA-11), «Sistema» when it never chose (CA-12). */
const themeChoice = async () => parseThemeChoice((await cookies()).get(THEME_COOKIE)?.value);

/**
 * The system bar takes the page's background (spec 006, CA-05) in the theme shown (spec 010,
 * CA-07): the chosen one, or, with «Sistema», each of the device's two.
 */
export const generateViewport = async (): Promise<Viewport> => {
  const choice = await themeChoice();
  if (choice !== 'system') return { themeColor: THEME_COLORS[choice] };
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: THEME_COLORS.light },
      { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark },
    ],
  };
};

/**
 * Root of every page. The theme is painted before anything shows (spec 010, CA-01, RF-03): the
 * server sets «Claro» or «Oscuro» from the device's cookie, and the `<head>` script settles
 * «Sistema» with the device's own preference. That script changes `<html>` before React hydrates,
 * hence `suppressHydrationWarning` there (and only there).
 */
const RootLayout = async ({ children }: { children: ReactNode }) => {
  const locale = await getLocale();
  const choice = await themeChoice();

  return (
    <html
      lang={locale}
      className={`${geist.variable} ${geistMono.variable} bg-background${choice === 'dark' ? ' dark' : ''}`}
      data-theme-choice={choice}
      style={choice === 'system' ? undefined : { colorScheme: choice }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* Spec 019: the page colour is on <html>; <body> stays transparent so the fixed backdrop
          (z-index −1) is painted between them, behind everything. */}
      <body className="min-h-dvh font-sans text-foreground antialiased">
        <div aria-hidden className="garage" />
        <Spotlight />
        <NextIntlClientProvider>
          <ThemeProvider initialChoice={choice}>
            <AppProvider>
              {children}
              <ToastRegion />
            </AppProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
};

export default RootLayout;
