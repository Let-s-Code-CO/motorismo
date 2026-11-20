import { createTranslator } from 'next-intl';

import { DEFAULT_LOCALE, messages } from '@web/i18n/messages';

/** Built once at build time: the same page for everyone, with nobody's data (RN-02). */
export const dynamic = 'force-static';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The "Sin conexión" page (spec 006, CA-09). The service worker keeps it and shows it, under the
 * address being opened, when a page cannot be reached; «Reintentar» reloads that address (CA-11).
 * Plain HTML with inline styles on purpose: without network, the app's scripts and style sheets
 * cannot load, so the page needs nothing but itself and its icon (also kept by the worker).
 * Colours from the visual system (spec 003): zinc base and a near-black primary.
 */
export const GET = () => {
  const t = createTranslator({ locale: DEFAULT_LOCALE, messages });
  const title = escape(t('pwa.offlinePage.title'));

  const html = `<!doctype html>
<html lang="${DEFAULT_LOCALE}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#fafafa">
<title>${title} · ${escape(t('core.brand.name'))}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px;
    background: #fafafa; color: #18181b;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 420px; text-align: center; display: flex; flex-direction: column;
    align-items: center; gap: 16px; }
  img { width: 88px; height: 88px; border-radius: 9999px; }
  h1 { margin: 8px 0 0; font-size: 1.5rem; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0; color: #52525b; line-height: 1.5; }
  button { margin-top: 8px; min-height: 44px; padding: 0 24px; border: 0; border-radius: 12px;
    background: #18181b; color: #ffffff; font: inherit; font-weight: 500; cursor: pointer; }
  button:hover { background: #27272a; }
  button:focus-visible { outline: 2px solid #18181b; outline-offset: 2px; }
</style>
</head>
<body>
<main>
<img src="/icons/icon-192.png" alt="${escape(t('core.brand.logoAlt'))}" width="88" height="88">
<h1>${title}</h1>
<p>${escape(t('pwa.offlinePage.body'))}</p>
<button type="button" onclick="location.reload()">${escape(t('pwa.offlinePage.retry'))}</button>
</main>
</body>
</html>
`;

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
};
