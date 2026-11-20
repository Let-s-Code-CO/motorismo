import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, TIME_ZONE, messages } from './messages';

// Single locale, no locale segment in the URL ("next-intl without i18n routing").
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  timeZone: TIME_ZONE,
  messages,
  // One «now» per request, handed to the browser: relative times («hace 33 minutos») then render
  // the same on the server and on hydration (spec 008), and useNow refreshes them afterwards.
  now: new Date(),
}));
