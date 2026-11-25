/**
 * The automotive premium look with a silver accent (spec 019), in a real browser, in light (project
 * `chromium`) and in dark (`chromium-dark`).
 *
 * - CA-01: the accent is steel with white ink in light and silver with dark ink in dark, with AA
 *   contrast; on the dark «Órdenes» block it is silver in both modes.
 * - CA-02, RN-02: a still backdrop (dotted, glow, grain) behind everything.
 * - CA-03, RN-01: chrome titles whose gradient keeps AA contrast for large text (axe does not
 *   measure text painted with a gradient).
 * - CA-04: numbers in a mono face; table headers in spaced mono capitals. A line that mixes words
 *   and figures, and the plate, keep Geist with aligned digits.
 * - CA-05, CA-06: larger card radii, a pressable card lit with the accent; the main button is a pill.
 * - CA-07: a floating pill header with the current section in the accent.
 * - CA-08: the staff home on a desktop as a bento: «Órdenes» two by two, no holes.
 * - CA-10, CA-11: the showroom grey and the near-black backgrounds, white and charcoal cards.
 * - CA-12, CA-13: the plate looks like metal; a glint crosses it once on hover of the plate or its
 *   row, not with less motion.
 */
import { type Locator, type Page, type TestInfo, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

test.use({ viewport: { width: 1280, height: 900 } });

const isDark = (testInfo: TestInfo) => testInfo.project.name === 'chromium-dark';

/** WCAG contrast ratio between two `rgb(…)` colours. */
const contrast = (a: string, b: string) => {
  const luminance = (colour: string) => {
    const [r, g, bl] = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number) as [
      number,
      number,
      number,
    ];
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

const css = (locator: Locator, property: string, pseudo?: string) =>
  locator.evaluate(
    (element, [name, after]) =>
      getComputedStyle(element, after || undefined).getPropertyValue(name as string),
    [property, pseudo ?? ''] as const
  );

/** The colour a CSS value computes to, through a probe element. */
const computed = (page: Page, value: string) =>
  page.evaluate((colour) => {
    const probe = document.createElement('span');
    probe.style.color = colour;
    document.body.append(probe);
    const result = getComputedStyle(probe).color;
    probe.remove();
    return result;
  }, value);

const pageBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

const STEEL = 'rgb(63, 63, 70)';
const SILVER = 'rgb(212, 212, 216)';

const toStaffHome = async (page: Page, email: string = SEED.admin.email) => {
  await signIn(page, email);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};
const sections = (page: Page) => page.getByRole('list', { name: 'Secciones' }).getByRole('link');

test.describe('the accent and the surfaces (CA-01, CA-10, CA-11)', () => {
  test('the main button and the current section take the accent, with AA contrast on it', async ({
    page,
  }, testInfo) => {
    await toStaffHome(page);
    await page.goto('/orders');
    const button = page
      .getByRole('link', { name: 'Nueva orden' })
      .or(page.getByRole('button', { name: 'Nueva orden' }));
    const accent = isDark(testInfo) ? SILVER : STEEL;
    expect(await css(button.first(), 'background-color')).toBe(accent);
    const ink = await css(button.first(), 'color');
    expect(contrast(accent, ink)).toBeGreaterThanOrEqual(4.5);

    const current = page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Órdenes' });
    expect(await css(current, 'background-color')).toBe(accent);
  });

  test('the figures of «Órdenes» are silver in both modes, readable on their dark block', async ({
    page,
  }) => {
    await toStaffHome(page);
    const figure = page.locator('[data-stat] > span').first();
    expect(await css(figure, 'color')).toBe(SILVER);
    expect(
      contrast(SILVER, await css(sections(page).first(), 'background-color'))
    ).toBeGreaterThanOrEqual(3);
  });

  test('the page is showroom grey or near black, and the cards white or charcoal', async ({
    page,
  }, testInfo) => {
    await toStaffHome(page);
    expect(await pageBackground(page)).toBe(
      isDark(testInfo) ? 'rgb(5, 5, 6)' : 'rgb(233, 235, 239)'
    );
    expect(await css(sections(page).nth(1), 'background-color')).toBe(
      isDark(testInfo) ? 'rgb(13, 13, 16)' : 'rgb(255, 255, 255)'
    );
  });
});

test('a still backdrop sits behind everything, out of reach (CA-02, RN-02)', async ({ page }) => {
  await toStaffHome(page);
  const backdrop = page.locator('.garage');
  await expect(backdrop).toHaveCount(1);
  expect(await css(backdrop, 'position')).toBe('fixed');
  expect(await css(backdrop, 'z-index')).toBe('-1');
  expect(await css(backdrop, 'pointer-events')).toBe('none');
  expect(
    await backdrop.evaluate((element) => element.getAnimations({ subtree: true }).length)
  ).toBe(0);
  // Its look: a glow on top, a glow in a corner and a fine dotted grid (three radial layers, the
  // dots every 22 px), fading downwards, and a faint grain over it.
  expect((await css(backdrop, 'background-image')).match(/radial-gradient/g)).toHaveLength(3);
  expect(await css(backdrop, 'background-size')).toContain('22px 22px');
  expect(await css(backdrop, 'mask-image')).toMatch(
    /linear-gradient\(.*rgba\(0, 0, 0, 0\) 100%\)$/
  );
  expect(await css(backdrop, 'background-image', '::after')).toContain('url(');
});

test.describe('titles, dashboard figures, cards and buttons', () => {
  test('every title is large, tight and chrome, each stop of its gradient readable as large text, for the staff and the customer (CA-03, RN-01)', async ({
    page,
  }) => {
    await toStaffHome(page);
    const paths = [
      '/',
      '/orders',
      '/customers',
      '/admin/vehicle-catalog',
      '/my',
      '/my/reservations',
    ];
    for (const path of paths) {
      if (path === '/my') {
        await page.context().clearCookies();
        await signIn(page, SEED_CUSTOMERS.customer.email);
        await expect(page).toHaveURL('/my');
      } else if (path !== '/') await page.goto(path);
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toBeVisible();
      // Large (at least 36 px) and tight (negative letter spacing).
      expect(Number.parseFloat(await css(title, 'font-size')), path).toBeGreaterThanOrEqual(36);
      expect(Number.parseFloat(await css(title, 'letter-spacing')), path).toBeLessThan(0);
      expect(await css(title, '-webkit-background-clip'), path).toBe('text');
      const stops = (await css(title, 'background-image')).match(/rgba?\([^)]+\)/g) ?? [];
      expect(stops.length, path).toBeGreaterThan(1);
      const background = await pageBackground(page);
      for (const stop of stops) {
        expect(contrast(stop, background), `${path} ${stop}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('figures are in the mono face and table headers in spaced mono capitals (CA-04)', async ({
    page,
  }) => {
    await toStaffHome(page);
    await page.goto('/customers');
    const header = page.locator('thead th').first();
    expect(await css(header, 'text-transform')).toBe('uppercase');
    expect(await css(header, 'font-family')).toContain('Geist Mono');
    const phone = page.locator('.tabular-nums').first();
    expect(await css(phone, 'font-family')).toContain('Geist Mono');
  });

  test('a line that mixes words and figures, and the plate, keep Geist with aligned digits (CA-04, CA-12)', async ({
    page,
  }) => {
    await toStaffHome(page);
    // «2 vehículos» / «Sin vehículos»: words in mono would read as code.
    await page.goto('/admin/vehicle-catalog');
    const count = page.getByText(/^(\d+ vehículos?|Sin vehículos)$/).first();
    expect(await css(count, 'font-family')).not.toContain('Geist Mono');
    expect(await css(count, 'font-variant-numeric')).toBe('tabular-nums');

    // The plate reproduces the real one (spec 005, HU-07): its characters stay in Geist.
    await page.goto('/customers');
    await page
      .getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) })
      .first()
      .click();
    const plate = page.locator('[data-plate]').first();
    await expect(plate).toBeVisible();
    expect(await css(plate.locator('.font-bold').first(), 'font-family')).not.toContain(
      'Geist Mono'
    );
  });

  test('cards have the larger radius and a lit edge, a light follows the cursor, and a pressable one lights its border with the accent (CA-05)', async ({
    page,
  }, testInfo) => {
    await toStaffHome(page);
    const card = sections(page).nth(1);
    expect(await css(card, 'border-top-left-radius')).toBe('22px');
    // A lit top edge: a light inset line in its shadow.
    expect(await css(card, 'box-shadow')).toContain('inset');
    // The light follows the cursor: drawn where the pointer is, relative to the card.
    await card.hover({ position: { x: 40, y: 30 } });
    // (within 2 px: the card's border and sub-pixel layout shift the pointer a little).
    const light = async () => {
      const [, x, y] = /at ([\d.]+)px ([\d.]+)px/.exec(await css(card, 'background-image')) ?? [];
      return Math.abs(Number(x) - 40) <= 2 && Math.abs(Number(y) - 30) <= 2;
    };
    await expect.poll(light).toBe(true);
    await card.hover();
    const accent = await computed(
      page,
      `color-mix(in srgb, ${isDark(testInfo) ? '#d4d4d8' : '#3f3f46'} 60%, transparent)`
    );
    await expect.poll(() => css(card, 'border-top-color')).toBe(accent);
  });

  test('the main button is a pill (CA-06)', async ({ page }) => {
    await toStaffHome(page);
    await page.goto('/orders');
    const button = page
      .getByRole('link', { name: 'Nueva orden' })
      .or(page.getByRole('button', { name: 'Nueva orden' }));
    expect(await css(button.first(), 'border-top-left-radius')).toBe('9999px');
  });
});

test.describe('the header and the home', () => {
  test('the header floats as a translucent pill, off the edges (CA-07)', async ({ page }) => {
    await toStaffHome(page);
    const header = page
      .getByRole('banner')
      .filter({ has: page.getByRole('navigation') })
      .first();
    const box = (await header.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(8);
    expect(box.x).toBeGreaterThanOrEqual(8);
    // Translucent: a see-through background, blurred behind.
    const alpha = /\/\s*([\d.]+)\)$|,\s*([\d.]+)\)$/.exec(await css(header, 'background-color'));
    expect(Number(alpha?.[1] ?? alpha?.[2] ?? 1)).toBeLessThan(1);
    expect(await css(header, 'backdrop-filter')).toContain('blur');
    // A pill: Tailwind 4's `rounded-full` is an «infinite» radius (3.35544e+07px).
    expect(Number.parseFloat(await css(header, 'border-top-left-radius'))).toBeGreaterThanOrEqual(
      9999
    );
  });

  for (const [who, email] of [
    ['an admin', SEED.admin.email],
    ['an operator', SEED.operator.email],
  ] as const) {
    test(`the home of ${who} is a bento: «Órdenes» two by two and no holes (CA-08)`, async ({
      page,
    }) => {
      await toStaffHome(page, email);
      const boxes = await Promise.all(
        (await sections(page).all()).map(async (tile) => (await tile.boundingBox())!)
      );
      const [orders, first] = boxes as [(typeof boxes)[0], (typeof boxes)[0]];
      // Four columns: «Órdenes» (two) and two more tiles side by side in its first row.
      expect(boxes.filter((box) => Math.abs(box.y - orders.y) <= 2)).toHaveLength(3);
      // Two columns and two rows of the others, with the gap between them (16 px).
      expect(Math.abs(orders.width - (first.width * 2 + 16))).toBeLessThanOrEqual(2);
      expect(Math.abs(orders.height - (first.height * 2 + 16))).toBeLessThanOrEqual(2);
      // No hole: the last tile ends where the grid does.
      const list = (await page.getByRole('list', { name: 'Secciones' }).boundingBox())!;
      const last = boxes.at(-1)!;
      expect(Math.abs(last.x + last.width - (list.x + list.width))).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('the metal plate (CA-12, CA-13)', () => {
  const toCamila = async (page: Page) => {
    await toStaffHome(page);
    await page.goto('/customers');
    await page
      .getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) })
      .first()
      .click();
    const plate = page.locator('[data-plate]').first();
    await expect(plate).toBeVisible();
    return plate;
  };

  test('keeps its yellow and ink, and gains embossed characters and two glints (CA-12)', async ({
    page,
  }) => {
    const plate = await toCamila(page);
    expect(await css(plate, 'background-image')).toContain('rgb(247, 198, 0)');
    expect(await css(plate, 'text-shadow')).not.toBe('none');
    expect(await css(plate, 'content', '::before')).not.toBe('none');
    expect(await css(plate, 'content', '::after')).not.toBe('none');
  });

  test('a glint crosses it once on hover (CA-13)', async ({ page }) => {
    const plate = await toCamila(page);
    const before = await css(plate, 'transform', '::after');
    await plate.hover();
    await expect.poll(() => css(plate, 'transform', '::after')).not.toBe(before);
    expect(await css(plate, 'transition-duration', '::after')).not.toBe('0s');
  });

  test('a glint crosses it once when its row is hovered, not only the plate (CA-13)', async ({
    page,
  }) => {
    const plate = await toCamila(page);
    const row = plate.locator('xpath=ancestor::li[1]');
    const before = await css(plate, 'transform', '::after');
    // The row's left edge, away from the plate (on its right).
    await row.hover({ position: { x: 4, y: 4 } });
    await expect.poll(() => css(plate, 'transform', '::after')).not.toBe(before);
  });

  test('the glint does not move when the device asks for less motion (CA-13, RN-02)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const plate = await toCamila(page);
    expect(await css(plate, 'transition-duration', '::after')).toBe('0s');
  });
});
