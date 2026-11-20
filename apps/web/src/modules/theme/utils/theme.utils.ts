import {
  THEME_CHOICES,
  THEME_COLORS,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type Theme,
  type ThemeChoice,
} from '@web/modules/theme/constants/theme.constants';

/** The saved choice, or «Sistema» when there is none or it is not one we know (CA-12). */
export const parseThemeChoice = (value: string | null | undefined): ThemeChoice =>
  THEME_CHOICES.find((choice) => choice === value) ?? 'system';

/** Which theme a choice means on a device that does or does not prefer dark (CA-01). */
export const resolveTheme = (choice: ThemeChoice, prefersDark: boolean): Theme =>
  choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice;

/** The cookie that remembers the choice on this device for a year (CA-11). */
export const themeCookie = (choice: ThemeChoice) =>
  `${THEME_COOKIE}=${choice}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;

/**
 * Paints a theme on the page: the `dark` class (Tailwind and HeroUI), the browser's colour
 * scheme (scrollbars, form controls) and the system bar (CA-07).
 */
export const applyTheme = (theme: Theme, doc: Document = document) => {
  const root = doc.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  doc.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  const meta = doc.createElement('meta');
  meta.name = 'theme-color';
  meta.content = THEME_COLORS[theme];
  doc.head.append(meta);
};
