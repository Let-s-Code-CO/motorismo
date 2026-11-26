import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** The serious and critical WCAG 2.1 AA problems axe finds on the page, as «rule: targets». */
export const audit = async (page: Page) => {
  // Every screen enters with a short fade (spec 011, `page-in`), and so do a floating notice
  // (spec 013) and «Ver todos» (filter bar): mid-fade, colours are blended and axe would measure a
  // contrast nobody sees (on the showroom grey of spec 019 such a blend dips below AA). Wait for
  // every animation that ends to do so first (none should run forever, WCAG 2.2.2 and spec 019
  // RN-02, which `ui.spec.ts` checks; one that did would otherwise stall the audit).
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished)
    )
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`);
};
