import type { MetadataRoute } from 'next';
import { createTranslator } from 'next-intl';

import { DEFAULT_LOCALE, messages } from '@web/i18n/messages';

/** The app's background (hero.ts): the system bar and the splash screen blend with the app. */
const APP_BACKGROUND = '#fafafa';

/**
 * What a browser reads to install Motorismo as an app (spec 006, HU-01): its name and icon, its
 * own window and the home page, which leads each person to what their role sees (CA-01 to CA-05).
 */
const manifest = async (): Promise<MetadataRoute.Manifest> => {
  const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: 'core' });

  return {
    id: '/',
    name: t('brand.name'),
    short_name: t('brand.short'),
    description: t('metadata.description'),
    lang: DEFAULT_LOCALE,
    start_url: '/',
    display: 'standalone',
    background_color: APP_BACKGROUND,
    theme_color: APP_BACKGROUND,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
};

export default manifest;
