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
 *
 * The page's `theme-color` tags come from the layout's viewport and belong to React: they are
 * recoloured in place (and lose their media query, so the chosen theme wins over the device's),
 * never removed. Removing them makes React's next navigation fail when it replaces them, and the
 * new screen never shows. On the next navigation the server renders them again for the saved
 * choice. A tag of our own is added only when the page has none.
 */
export const applyTheme = (theme: Theme, doc: Document = document) => {
  const root = doc.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;

  if (!doc.querySelector('meta[name="theme-color"]')) {
    const meta = doc.createElement('meta');
    meta.name = 'theme-color';
    doc.head.append(meta);
  }
  doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute('media');
    meta.content = THEME_COLORS[theme];
  });
};
