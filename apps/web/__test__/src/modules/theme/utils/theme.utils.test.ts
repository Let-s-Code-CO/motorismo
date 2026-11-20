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
 */
import { THEME_COOKIE } from '@web/modules/theme/constants/theme.constants';
import { parseThemeChoice, resolveTheme, themeCookie } from '@web/modules/theme/utils/theme.utils';

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
