/**
 * Theme utilities (spec 010): what the device chose, which theme that means, and the cookie that
 * remembers it.
 *
 * Guards:
 * - CA-12: anything that is not a known choice (no cookie, an old or tampered value) means
 *   «Sistema».
 * - CA-01: «Sistema» follows the device (dark when it prefers dark); «Claro» and «Oscuro» ignore it.
 * - CA-11 / RN-02: the choice is remembered on the device for a year, for the whole site, sent
 *   with every navigation (SameSite=Lax) so the server paints the right theme; nothing else in it.
 * - CA-07: painting a theme sets the system bar colour (`theme-color`). The page's own
 *   `theme-color` tags belong to React (the layout's viewport): they are updated in place, never
 *   removed, or React's next navigation tries to remove a tag that is no longer there, throws, and
 *   the new screen never shows.
 */
import { THEME_COOKIE } from '@web/modules/theme/constants/theme.constants';
import {
  applyTheme,
  parseThemeChoice,
  resolveTheme,
  themeCookie,
} from '@web/modules/theme/utils/theme.utils';

describe('parseThemeChoice', () => {
  it('keeps the three known choices', () => {
    expect(parseThemeChoice('light')).toBe('light');
    expect(parseThemeChoice('dark')).toBe('dark');
    expect(parseThemeChoice('system')).toBe('system');
  });

  it('falls back to «Sistema» without a cookie or with an unknown value (CA-12)', () => {
    expect(parseThemeChoice(undefined)).toBe('system');
    expect(parseThemeChoice(null)).toBe('system');
    expect(parseThemeChoice('')).toBe('system');
    expect(parseThemeChoice('DARK')).toBe('system');
    expect(parseThemeChoice('blue')).toBe('system');
  });
});

describe('resolveTheme', () => {
  it('follows the device with «Sistema» (CA-01)', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the device with «Claro» or «Oscuro»', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('themeCookie', () => {
  it('remembers the choice on this device for a year, for the whole site (CA-11)', () => {
    // 60 s × 60 min × 24 h × 365 days = 31 536 000 s.
    expect(themeCookie('dark')).toBe(
      `${THEME_COOKIE}=dark; Path=/; Max-Age=31536000; SameSite=Lax`
    );
  });
});

describe('applyTheme', () => {
  /** The tags the layout renders for «Sistema»: one colour per device preference. */
  const systemTags = () => {
    document.head.innerHTML =
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#e9ebef">' +
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#050506">';
    return [...document.querySelectorAll('meta[name="theme-color"]')];
  };
  const tags = () =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => ({
      media: meta.getAttribute('media'),
      content: meta.getAttribute('content'),
    }));

  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  it('paints dark: the dark class, the colour scheme and a near-black system bar (CA-07)', () => {
    applyTheme('dark');

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(tags()).toEqual([{ media: null, content: '#050506' }]);
  });

  it('keeps the page own theme-color tags attached, recoloured for the chosen theme (React owns them)', () => {
    const [light, dark] = systemTags();

    applyTheme('dark');

    // The same two nodes, still in the page: React can replace them on the next navigation.
    expect(light!.isConnected).toBe(true);
    expect(dark!.isConnected).toBe(true);
    // Without their media query, both say the chosen theme whatever the device prefers.
    expect(tags()).toEqual([
      { media: null, content: '#050506' },
      { media: null, content: '#050506' },
    ]);
  });

  it('adds no tag of its own when the page already has one, however many times it is painted', () => {
    systemTags();

    applyTheme('dark');
    applyTheme('light');

    expect(tags()).toEqual([
      { media: null, content: '#e9ebef' },
      { media: null, content: '#e9ebef' },
    ]);
  });
});
