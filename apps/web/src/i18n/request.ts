import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, TIME_ZONE, messages } from './messages';

// Single locale, no locale segment in the URL ("next-intl without i18n routing").
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: TIME_ZONE,
  messages,
}));
