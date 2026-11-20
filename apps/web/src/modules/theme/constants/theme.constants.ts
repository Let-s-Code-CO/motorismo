/** The device's cookie that remembers the chosen theme (spec 010, CA-11, RN-02). */
export const THEME_COOKIE = 'motorismo-theme';

/** A year, in seconds (60 × 60 × 24 × 365). */
export const THEME_COOKIE_MAX_AGE = 31_536_000;

/** What can be chosen: «Claro», «Oscuro» or «Sistema» (follow the device; the default, CA-12). */
export const THEME_CHOICES = ['light', 'dark', 'system'] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** What is shown. */
export type Theme = 'light' | 'dark';

/** The page's background in each theme, also the system bar's colour (CA-07; `hero.ts`). */
export const THEME_COLORS: Record<Theme, string> = { light: '#fafafa', dark: '#09090b' };

/** The device's own preference, as the browser reports it. */
export const PREFERS_DARK = '(prefers-color-scheme: dark)';
