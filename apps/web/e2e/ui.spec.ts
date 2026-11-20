/**
 * Layout checks of the redesign (spec 003).
 * CA-02 no horizontal scroll on a 360 px phone (spec 004 adds sign-up, Clientes, a customer record
 * and "Mi perfil": the customer signs up from their phone; spec 005 the vehicles and their form) · CA-03 brand panel beside the form on desktop only ·
 * every clickable element shows the hand cursor (Tailwind 4 no longer sets it on buttons) ·
 * placeholders look muted, distinct from typed text (theme foreground scale).
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, adminClient, signIn } from './support/sandbox';

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('on a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('login, home and users have no horizontal scroll (CA-02)', async ({ page }) => {
    await page.goto('/auth/login');
    expect(await horizontalOverflow(page)).toBe(0);

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    expect(await horizontalOverflow(page)).toBe(0);

    await page.goto('/admin/users');
    await expect(page.getByRole('grid')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.goto('/customers');
    await expect(page.getByRole('grid')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await expect(page.getByRole('heading', { name: SEED_CUSTOMERS.walkIn.name })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('a new order and the detail of an open order have no horizontal scroll (spec 008)', async ({
    page,
  }) => {
    const { data: open } = await adminClient()
      .from('work_orders')
      .select('id')
      .eq('status', 'open')
      .order('number')
      .limit(1)
      .single();
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');

    await page.goto('/orders/new');
    await page.getByLabel('Buscar cliente').fill(SEED_CUSTOMERS.walkIn.name);
    await page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: 'Añadir Lavado detallado' }).click();
    await page.getByRole('button', { name: 'Añadir Otro' }).click();
    // The summary stays in sight at the bottom.
    await expect(page.getByRole('region', { name: 'Resumen de la orden' })).toBeInViewport();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.goto(`/orders/${open!.id}`);
    await expect(page.getByRole('region', { name: 'Resumen de la orden' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('with every staff section, the menu fits: it moves into «Menú»; a long service fits too (spec 007, CA-19)', async ({
    page,
  }) => {
    // A long name with high prices in every type: the widest row «Servicios» can have.
    const longName = `E2E Servicio con un nombre bastante largo para un teléfono ${Date.now()}`;
    await adminClient().from('services').insert({
      name: longName,
      price_motorcycle: 9_500_000,
      price_car: 9_800_000,
      price_bicycle: 9_900_000,
    });
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: 'Menú' }).click();
    await page.getByRole('menuitemradio', { name: 'Servicios' }).click();
    await expect(page).toHaveURL('/services');
    // Measured once the menu has closed: its popover is not part of the page.
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('grid', { name: 'Servicios activos' })).toContainText(longName);
    // The steady state: the menu's popover may still be animating out for a moment under load.
    await expect.poll(() => horizontalOverflow(page)).toBe(0);
    await adminClient().from('services').delete().eq('name', longName);
  });

  test('the vehicles of a customer and the vehicle form have no horizontal scroll (spec 005)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto('/customers');
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    const vehicles = page.getByRole('region', { name: 'Vehículos' });
    await expect(vehicles.getByText('Mazda CX-30')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await vehicles.getByRole('button', { name: 'Agregar vehículo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar vehículo' });
    await dialog.getByRole('radio', { name: 'Carro' }).check();
    await expect(dialog.getByRole('radio', { name: 'Camioneta' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('sign-up and "Mi perfil" have no horizontal scroll (spec 004)', async ({ page }) => {
    await page.goto('/auth/sign-up');
    expect(await horizontalOverflow(page)).toBe(0);

    await signIn(page, SEED_CUSTOMERS.customer.email);
    await expect(page).toHaveURL('/profile');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('the login shows only the form, without the brand panel (CA-03)', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('complementary', { name: 'Motorismo Detailing' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the login shows the brand panel beside the form (CA-03)', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('complementary', { name: 'Motorismo Detailing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});

test.describe('pointer cursor', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  const cursorOf = (locator: import('@playwright/test').Locator) =>
    locator.evaluate((element) => getComputedStyle(element).cursor);

  test('custom buttons show the hand cursor: password toggle and summary filters', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    expect(await cursorOf(page.getByRole('button', { name: 'Mostrar contraseña' }))).toBe(
      'pointer'
    );

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto('/admin/users');
    expect(await cursorOf(page.getByRole('button', { name: /^Activos \d+$/ }))).toBe('pointer');
  });
});

test.describe('customer record actions', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('"Desactivar cliente" is a strong call to action: solid danger-600 red with white text (AA contrast, 6.1:1)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();

    const disable = page.getByRole('button', { name: 'Desactivar cliente' });
    const colours = await disable.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      text: getComputedStyle(element).color,
    }));

    expect(colours.background).toBe('rgb(194, 14, 77)'); // danger-600, #c20e4d
    expect(colours.text).toBe('rgb(255, 255, 255)');
  });

  test('"Retirar" a vehicle reads as danger: red text and icon without a red background; the confirmation is solid red', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();

    const retire = page.getByRole('button', { name: /^Retirar Suzuki GSX-R600/ });
    const row = await retire.evaluate((element) => ({
      text: getComputedStyle(element).color,
      icon: getComputedStyle(element.querySelector('svg')!).color,
      background: getComputedStyle(element).backgroundColor,
    }));
    expect(row.text).toBe('rgb(194, 14, 77)'); // danger-600, #c20e4d
    expect(row.icon).toBe('rgb(194, 14, 77)');
    expect(row.background).toBe('rgba(0, 0, 0, 0)'); // no red background at rest

    await retire.click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Retirar', exact: true });
    expect(await confirm.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      'rgb(194, 14, 77)'
    );
    await page.keyboard.press('Escape'); // nothing is retired
  });

  test('in the vehicle form, fields side by side start at the same height even when one has help text below (in a car, Placa beside Ciudad de la placa)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: /^Editar Mazda CX-30/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar vehículo' });
    await expect(dialog.getByText('Tres letras y tres números. Ej.: ABC-123.')).toBeVisible();

    const top = async (text: string) =>
      (await dialog.getByText(text, { exact: true }).boundingBox())!.y;
    // Same row: the labels line up (1 px of rounding allowed).
    expect(Math.abs((await top('Ciudad de la placa')) - (await top('Placa')))).toBeLessThanOrEqual(
      1
    );
  });

  test('the plate is drawn yellow with black characters, a car with its city and a motorcycle with COLOMBIA (CA-27)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    const vehicles = page.getByRole('region', { name: 'Vehículos' });
    // Valentina's KDM-482 (seeds), issued in Bogotá, D.C.
    const carPlate = vehicles.getByText('KDM-482', { exact: true });
    const look = await carPlate.evaluate((characters) => {
      const plate = characters.parentElement!;
      return {
        background: getComputedStyle(plate).backgroundImage,
        ink: getComputedStyle(characters).color,
        below: plate.lastElementChild!.textContent,
      };
    });
    expect(look.background).toContain('rgb(255, 219, 61)'); // --color-plate-light, #ffdb3d
    expect(look.background).toContain('rgb(247, 198, 0)'); // --color-plate, #f7c600
    expect(look.ink).toBe('rgb(17, 17, 17)'); // --color-plate-ink, #111
    expect(look.below).toBe('BOGOTÁ, D.C.');

    // Camila's UIH-03D (seeds): the same plate, with COLOMBIA below.
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
    const motoPlate = page
      .getByRole('region', { name: 'Vehículos' })
      .getByText('UIH-03D', { exact: true });
    expect(
      await motoPlate.evaluate(
        (characters) => characters.parentElement!.lastElementChild!.textContent
      )
    ).toBe('COLOMBIA');
  });

  test('the colour list of a car (Color in the left column) opens right under the field, over the modal without being clipped, and each swatch is centred on its name', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: /^Editar Mazda CX-30/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar vehículo' });
    await dialog.getByRole('button', { name: /Color/ }).click();
    const listbox = page.getByRole('listbox');
    await expect(listbox.getByRole('option', { name: 'Gris' })).toBeVisible();
    await page.waitForTimeout(400); // popover animation

    // Nothing covers or clips the bottom of the open list. The list scrolls inside its own
    // viewport (the nearest scrolling ancestor): the point just above that viewport's bottom edge
    // must belong to the list (a list clipped by the modal leaves the modal's content there).
    const reachesBottom = await listbox.evaluate((element) => {
      let viewport: Element = element;
      while (
        viewport.parentElement &&
        !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)
      ) {
        viewport = viewport.parentElement;
      }
      const box = viewport.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.bottom - 6);
      return hit !== null && viewport.contains(hit);
    });
    expect(reachesBottom).toBe(true);

    // The list opens right under the field, not shifted sideways: same left edge (±1 px).
    const fieldBox = (await dialog.getByRole('button', { name: /Color/ }).boundingBox())!;
    const popoverBox = (await page
      .locator('[data-slot="content"]', { has: listbox })
      .boundingBox())!;
    expect(Math.abs(popoverBox.x - fieldBox.x)).toBeLessThanOrEqual(1);

    // Swatch and name share the same vertical centre in the options and in the chosen value.
    const offCentre = (scope: import('@playwright/test').Locator, name: string) =>
      scope.evaluate((element, colourName) => {
        const swatch = element.querySelector('[data-swatch]')!.getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && node.textContent?.trim() !== colourName) node = walker.nextNode();
        const range = document.createRange();
        range.selectNodeContents(node!);
        const text = range.getBoundingClientRect();
        return Math.abs(swatch.top + swatch.height / 2 - (text.top + text.height / 2));
      }, name);
    expect(
      await offCentre(listbox.getByRole('option', { name: 'Rojo' }), 'Rojo')
    ).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    expect(
      await offCentre(dialog.getByRole('button', { name: /Color/ }), 'Gris')
    ).toBeLessThanOrEqual(1);

    // Any drop-down of the form behaves the same: the brand list (also in the left column).
    const brand = dialog.getByRole('combobox', { name: /Marca/ });
    await brand.click();
    await expect(page.getByRole('option', { name: 'Mazda' })).toBeVisible();
    await page.waitForTimeout(400); // popover animation
    const brandField = (await dialog
      .locator('[data-slot="input-wrapper"]', {
        has: page.getByRole('combobox', { name: /Marca/ }),
      })
      .boundingBox())!;
    const brandPopover = (await page
      .locator('[data-slot="content"]', { has: page.getByRole('listbox') })
      .boundingBox())!;
    expect(Math.abs(brandPopover.x - brandField.x)).toBeLessThanOrEqual(1);
  });

  test('every one-line radio label is optically centred on its circle (Tipo, Clase); a role card centres it on the role name (Rol)', async ({
    page,
  }) => {
    // The circle's centre against the centre of the word as drawn (capitals, lower case and accents
    // together, from their top to the baseline), not against the text's line box, which Geist's uneven vertical metrics
    // leave about half a pixel off the letters. Negative = the word sits above the circle's centre.
    const offsets = (scope: import('@playwright/test').Locator) =>
      scope.evaluate((element) =>
        [...element.querySelectorAll('input[type="radio"]')].map((input) => {
          const label = input.closest('label')!;
          const circle = input.nextElementSibling!.getBoundingClientRect();
          const text = label.querySelector('div > span')! as HTMLElement;
          const probe = document.createElement('span');
          probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
          text.appendChild(probe);
          const baseline = probe.getBoundingClientRect().top;
          probe.remove();
          const style = getComputedStyle(text);
          const context = document.createElement('canvas').getContext('2d')!;
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const ink = context.measureText(text.firstChild?.textContent ?? '');
          // Descenders (the "p" of "Operador") do not count for the eye: top of the letters to baseline.
          const inkCentre = baseline - ink.actualBoundingBoxAscent / 2;
          return {
            name: text.firstChild?.textContent,
            off: inkCentre - (circle.top + circle.height / 2),
          };
        })
      );
    const expectCentred = (list: { name?: string | null; off: number }[], count: number) => {
      expect(list.length).toBe(count);
      for (const { name, off } of list) expect(Math.abs(off), name ?? '').toBeLessThanOrEqual(0.4);
    };

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: /^Editar Mazda CX-30/ }).click();
    const vehicleDialog = page.getByRole('dialog', { name: 'Editar vehículo' });
    await expect(vehicleDialog.getByRole('radio', { name: 'Camioneta' })).toBeAttached();
    await page.waitForTimeout(400); // modal animation
    expectCentred(await offsets(vehicleDialog), 5); // Motocicleta, Bicicleta, Carro · Automóvil, Camioneta
    await page.keyboard.press('Escape');

    // Radios with a description (invite form: Rol) are cards: the circle sits beside the role's
    // name (first line), so it is centred on that word, not on the whole card.
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Invitar usuario' }).click();
    const inviteDialog = page.getByRole('dialog', { name: /Invitar usuario/ });
    await expect(inviteDialog.getByRole('radio').first()).toBeAttached();
    await page.waitForTimeout(400); // modal animation
    const roles = await offsets(inviteDialog);
    expectCentred(roles, 2); // Operador, Administrador
  });

  test('"Editar datos" is an icon button inside "Datos de contacto", with the hand cursor', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();

    const edit = page
      .getByRole('region', { name: 'Datos de contacto' })
      .getByRole('button', { name: 'Editar datos' });
    await expect(edit).toBeVisible();
    expect(await edit.evaluate((element) => getComputedStyle(element).cursor)).toBe('pointer');
  });
});

test.describe('placeholders', () => {
  test('are painted in the muted zinc-500 grey, not in the colour of typed text, so an empty field does not look filled in', async ({
    page,
  }) => {
    // HeroUI paints placeholders with `foreground-500`; if the theme drops the foreground scale the
    // rule becomes invalid and the placeholder inherits the near-black text colour (#18181b).
    await page.goto('/auth/login');
    const email = page.getByPlaceholder('tu@correo.com');

    const colours = await email.evaluate((element) => ({
      placeholder: getComputedStyle(element, '::placeholder').color,
      text: getComputedStyle(element).color,
    }));

    expect(colours.placeholder).toBe('rgb(113, 113, 122)'); // zinc-500, #71717a
    expect(colours.text).toBe('rgb(24, 24, 27)'); // foreground, #18181b
  });
});
