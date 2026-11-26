import { type Locator, expect } from '@playwright/test';

/**
 * Waits until React has taken over an element (hydrated it): it then carries React's props. A tap
 * before that reaches plain HTML: a link reloads the whole page instead of navigating inside the
 * app, and a choice made is undone when React hydrates. `networkidle` is not enough: with a busy
 * machine the network goes quiet before React has run.
 */
export const untilHydrated = async (element: Locator) =>
  expect
    .poll(
      () =>
        element.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith('__reactProps$'))
        ),
      { timeout: 30_000, message: 'hydrated by React' }
    )
    .toBe(true);
