// @vitest-environment node
/**
 * manifest — what a browser reads to install Motorismo as an app (spec 006, HU-01).
 *
 * Guards:
 * - CA-01 / RF-01: the app installs as «Motorismo Detailing» with the brand icon (192 and 512 px,
 *   plus a maskable one that Android may crop to a circle).
 * - CA-02: it opens in its own window (standalone, no address bar) with the short name
 *   «Motorismo» under the icon.
 * - CA-03 / RF-02: it starts at the home page, which leads each person to what their role sees.
 * - CA-05: the system bar and the splash screen use the app's background colour (#fafafa, the
 *   background of the visual system, spec 003), not a generic one.
 */
import manifest from '@web/app/manifest';

describe('manifest', () => {
  it('names the app «Motorismo Detailing», with «Motorismo» as the short name (CA-01, CA-02)', async () => {
    const m = await manifest();

    expect(m.name).toBe('Motorismo Detailing');
    expect(m.short_name).toBe('Motorismo');
  });

  it('opens in its own window, starting at the home page (CA-02, CA-03)', async () => {
    const m = await manifest();

    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.id).toBe('/');
  });

  it("uses the app's background colour for the system bar and the splash screen (CA-05)", async () => {
    const m = await manifest();

    expect(m.theme_color).toBe('#fafafa');
    expect(m.background_color).toBe('#fafafa');
  });

  it('lists the brand icon at 192 and 512 px, and a maskable 512 px one (CA-01)', async () => {
    const m = await manifest();

    expect(m.icons).toEqual([
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ]);
  });
});
