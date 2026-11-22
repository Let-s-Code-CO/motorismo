/**
 * Floating notices (spec 013) in a real browser.
 *
 * - CA-01: a confirmation shows within the window even when the button was at the bottom of a long
 *   page («Horario»), which is what the person saw fail before.
 * - CA-02: from a tablet on, at the bottom right; on a phone, at the bottom and full width, with no
 *   sideways scroll.
 * - CA-03: it closes by itself after 5 s.
 * - CA-07: the refusal of a standalone action stays until it is closed.
 * - CA-11: «Cerrar» is reached and pressed with the keyboard.
 * - CA-12: with «reducir movimiento» it appears without moving.
 * The notice for the screen an action leads to (CA-05) is checked where it happens: booking a
 * reservation (`reservations.spec.ts`), including that a reload does not repeat it.
 */
import { type Locator, expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';
import {
  NO_SHOW_REFUSED,
  SETTINGS_SAVED,
  refuseNoShow,
  saveAgendaSettings,
  toast,
} from './support/toasts';

/** Measured once it has come in: mid-animation it is a few pixels lower. */
const settled = (notice: Locator) =>
  notice.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished))
  );

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a confirmation from the bottom of «Horario» shows at the bottom right, and goes after 5 s (CA-01, CA-02, CA-03)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await saveAgendaSettings(page);
    const saved = Date.now();
    const notice = toast(page, SETTINGS_SAVED);

    await expect(notice).toBeInViewport();
    await settled(notice);
    const box = (await notice.boundingBox())!;
    // 24 px from the right and the bottom edges (md:right-6, md:bottom-6), 384 px wide (md:w-96).
    expect(Math.round(1280 - (box.x + box.width))).toBe(24);
    expect(Math.round(800 - (box.y + box.height))).toBe(24);
    expect(Math.round(box.width)).toBe(384);
    expect(await notice.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      'toast-in'
    );

    await expect(notice).toHaveCount(0, { timeout: 8_000 });
    expect(Date.now() - saved).toBeGreaterThan(4_000);
  });

  test('the refusal of a standalone action stays until it is closed, with the keyboard too (CA-07, CA-11)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    const cleanup = await refuseNoShow(page);

    const refusal = toast(page, NO_SHOW_REFUSED);
    await page.waitForTimeout(6_000);
    await expect(refusal).toBeVisible();
    // CA-11: reachable with the keyboard. The notices come after the page: from the button just
    // pressed, Tab reaches «Cerrar» (a few stops later, never more than 30).
    const close = refusal.getByRole('button', { name: 'Cerrar' });
    for (let stops = 0; stops < 30; stops += 1) {
      if (await close.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(close).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(refusal).toHaveCount(0);
    await cleanup();
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

  test('a confirmation shows at the bottom, full width, without sideways scroll (CA-02)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await saveAgendaSettings(page);
    const notice = toast(page, SETTINGS_SAVED);

    await expect(notice).toBeInViewport();
    await settled(notice);
    const box = (await notice.boundingBox())!;
    // 16 px from each side and from the bottom (inset-x-4, bottom-4): 360 − 2 × 16 = 328 wide.
    expect(Math.round(box.x)).toBe(16);
    expect(Math.round(box.width)).toBe(328);
    expect(Math.round(780 - (box.y + box.height))).toBe(16);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    ).toBe(0);
  });
});

test.describe('with «reducir movimiento»', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

  test('a notice appears without moving (CA-12)', async ({ page }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await saveAgendaSettings(page);

    expect(
      await toast(page, SETTINGS_SAVED).evaluate(
        (element) => getComputedStyle(element).animationName
      )
    ).toBe('none');
  });
});
