/**
 * Hovering a summary card lights it up; it never moves (summary cards standard, specs 003 CA-09
 * and 004 CA-17; dark theme, spec 010).
 *
 * In light the shadow grows and the border darkens a step. In dark a shadow does not show on the
 * near-black page, so the card's background and border turn a step lighter instead. In both, the
 * card stays where it is (no lift): the change is in light, not in position.
 *
 * Colours are the theme's zinc steps, as the browser computes them.
 */
import { type Locator, expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

const ZINC = {
  300: 'rgb(212, 212, 216)',
  600: 'rgb(82, 82, 91)',
  700: 'rgb(63, 63, 70)',
  800: 'rgb(39, 39, 42)',
};

const style = (card: Locator, property: 'backgroundColor' | 'borderColor') =>
  card.evaluate((element, name) => getComputedStyle(element)[name], property);

/** Where the card is drawn on the screen, whatever CSS property (transform, translate…) moves it. */
const top = (card: Locator) => card.evaluate((element) => element.getBoundingClientRect().top);

/** Hovers the card, waits for its 200 ms transition to settle as `check` expects, and checks that
 * it has not moved. */
const hoverUntil = async (card: Locator, check: () => Promise<void>) => {
  // The screen enters rising a few pixels (spec 011, `page-in`): measure once it has settled.
  await card
    .page()
    .locator('[data-page]')
    .evaluate((page) => Promise.all(page.getAnimations().map((animation) => animation.finished)));
  const before = await top(card);
  await card.hover();
  await check();
  expect(await top(card)).toBe(before);
};

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('in light', () => {
  test('a user card darkens its border on hover and stays in place', async ({ page }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto('/admin/users');
    const card = page.getByRole('button', { name: /^Invitados \d+$/ });

    await hoverUntil(card, () => expect.poll(() => style(card, 'borderColor')).toBe(ZINC[300]));
  });
});

test.describe('in dark', () => {
  test.use({ colorScheme: 'dark' });

  test('a user card turns a step lighter on hover (zinc-900 → zinc-800) and stays in place', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto('/admin/users');
    const card = page.getByRole('button', { name: /^Invitados \d+$/ });

    await hoverUntil(card, async () => {
      await expect.poll(() => style(card, 'backgroundColor')).toBe(ZINC[800]);
      await expect.poll(() => style(card, 'borderColor')).toBe(ZINC[600]);
    });
  });

  test('a part of a panel turns lighter too (zinc-700), not darker, and stays in place', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto('/customers');
    const part = page.getByRole('button', { name: /^Con cuenta \d+$/ });

    await hoverUntil(part, () => expect.poll(() => style(part, 'backgroundColor')).toBe(ZINC[700]));
  });
});
