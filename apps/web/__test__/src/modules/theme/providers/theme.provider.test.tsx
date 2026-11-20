/**
 * ThemeProvider (spec 010): applies the chosen theme to the page and keeps following the device
 * while the choice is «Sistema».
 *
 * Guards:
 * - CA-09 / CA-10 / CA-11: choosing a theme changes the page at once (the `dark` class and the
 *   browser's colour scheme) and remembers it in the device's cookie.
 * - CA-07: the system bar colour (`theme-color`) follows the theme: #09090b dark, #fafafa light.
 * - CA-02: with «Sistema», a change of the device's theme while the app is open applies at once;
 *   with «Claro» or «Oscuro» it does not.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';

import type { ThemeChoice } from '@web/modules/theme/constants/theme.constants';
import { ThemeProvider, useTheme } from '@web/modules/theme/providers/theme.provider';

/** A controllable `prefers-color-scheme: dark`, as the device reports it. */
const deviceScheme = (prefersDark: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches: prefersDark,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', () => query);
  return {
    change: (dark: boolean) => {
      query.matches = dark;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
};

/** Buttons that choose each theme, as the menus do. */
const Chooser = () => {
  const { setChoice } = useTheme();
  return (
    <>
      {(['light', 'dark', 'system'] as const).map((choice) => (
        <button key={choice} type="button" onClick={() => setChoice(choice)}>
          {choice}
        </button>
      ))}
    </>
  );
};

const choose = (choice: ThemeChoice) =>
  fireEvent.click(screen.getByRole('button', { name: choice }));

const renderProvider = (initialChoice: ThemeChoice) =>
  render(
    <ThemeProvider initialChoice={initialChoice}>
      <Chooser />
    </ThemeProvider>
  );

const root = () => document.documentElement;
const themeColor = () =>
  [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) =>
    meta.getAttribute('content')
  );

describe('ThemeProvider', () => {
  beforeEach(() => {
    root().className = '';
    root().removeAttribute('style');
    document.head.innerHTML = '';
    document.cookie = 'motorismo-theme=; Max-Age=0; Path=/';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('applies «Oscuro» at once and remembers it on the device (CA-09, CA-11)', () => {
    deviceScheme(false);
    renderProvider('system');

    choose('dark');

    expect(root()).toHaveClass('dark');
    expect(root().style.colorScheme).toBe('dark');
    expect(document.cookie).toContain('motorismo-theme=dark');
  });

  it('applies «Claro» even on a dark device (CA-10)', () => {
    deviceScheme(true);
    renderProvider('dark');

    choose('light');

    expect(root()).not.toHaveClass('dark');
    expect(root().style.colorScheme).toBe('light');
    expect(document.cookie).toContain('motorismo-theme=light');
  });

  it('paints the system bar with the theme (CA-07)', () => {
    deviceScheme(false);
    renderProvider('system');

    choose('dark');
    expect(themeColor()).toEqual(['#09090b']);

    choose('light');
    expect(themeColor()).toEqual(['#fafafa']);
  });

  it('follows the device while open with «Sistema» (CA-02)', () => {
    const device = deviceScheme(false);
    renderProvider('system');

    device.change(true);
    expect(root()).toHaveClass('dark');

    device.change(false);
    expect(root()).not.toHaveClass('dark');
  });

  it('stops following the device once «Claro» is chosen (CA-02)', () => {
    const device = deviceScheme(false);
    renderProvider('system');

    choose('light');
    device.change(true);

    expect(root()).not.toHaveClass('dark');
  });
});
