// @vitest-environment node
/**
 * GET /offline — the "Sin conexión" page that the service worker shows when a page cannot be
 * reached (spec 006, HU-02).
 *
 * Guards:
 * - CA-09: the person sees a page of the app (brand, «Sin conexión», what to do) instead of the
 *   browser's error, with a «Reintentar» button.
 * - CA-11: «Reintentar» reloads the address the person was opening (the service worker serves this
 *   page under that address), so with the network back they land where they were going.
 * - RN-02: the page is the same for everyone and shows nobody's data; it is self-contained (inline
 *   styles, no scripts or style sheets to fetch), because without network nothing else can load.
 */
import { GET } from '@web/app/offline/route';

const render = async () => {
  const response = GET();
  return { response, html: await response.text() };
};

describe('GET /offline', () => {
  it('answers HTML in Spanish with the brand icon and «Sin conexión» (CA-09)', async () => {
    const { response, html } = await render();

    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<title>Sin conexión · Motorismo Detailing</title>');
    expect(html).toContain('<h1>Sin conexión</h1>');
    expect(html).toContain(
      'No hay conexión a internet. Motorismo solo funciona conectado: cuando vuelva la red, pulsa «Reintentar».'
    );
    expect(html).toContain('<img src="/icons/icon-192.png" alt="Logo de Motorismo Detailing"');
  });

  it('offers «Reintentar», which reloads the address being opened (CA-11)', async () => {
    const { html } = await render();

    expect(html).toContain('<button type="button" onclick="location.reload()">Reintentar</button>');
  });

  it('is self-contained: no scripts or style sheets to fetch, and no personal data (RN-02)', async () => {
    const { html } = await render();

    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/@/);
  });
});
