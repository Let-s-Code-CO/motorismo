'use client';

import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';

import { PREFERS_DARK, type ThemeChoice } from '@web/modules/theme/constants/theme.constants';
import { applyTheme, resolveTheme, themeCookie } from '@web/modules/theme/utils/theme.utils';

type ThemeContextValue = { choice: ThemeChoice; setChoice: (choice: ThemeChoice) => void };

// Outside the provider (isolated tests, a page without it) there is «Sistema» and nothing to set.
const ThemeContext = createContext<ThemeContextValue>({ choice: 'system', setChoice: () => {} });

type ThemeProviderProps = {
  /** The device's choice, read from its cookie by the server (spec 010, CA-11). */
  initialChoice: ThemeChoice;
  children: ReactNode;
};

/**
 * Keeps the page in the chosen theme (spec 010). Choosing applies it at once and remembers it in
 * the device's cookie (CA-09 to CA-11); with «Sistema», a change of the device's theme while the
 * app is open applies at once, without reloading (CA-02). The first paint is the server's and the
 * `<head>` script's job (CA-01).
 */
export const ThemeProvider = ({ initialChoice, children }: ThemeProviderProps) => {
  const [choice, setChoiceState] = useState<ThemeChoice>(initialChoice);

  const setChoice = useCallback((next: ThemeChoice) => {
    document.cookie = themeCookie(next);
    document.documentElement.setAttribute('data-theme-choice', next);
    applyTheme(resolveTheme(next, window.matchMedia(PREFERS_DARK).matches));
    setChoiceState(next);
  }, []);

  useEffect(() => {
    if (choice !== 'system') return;
    const query = window.matchMedia(PREFERS_DARK);
    const follow = () => applyTheme(resolveTheme('system', query.matches));
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [choice]);

  return <ThemeContext value={{ choice, setChoice }}>{children}</ThemeContext>;
};

/** The device's theme choice and how to change it. */
export const useTheme = () => useContext(ThemeContext);
