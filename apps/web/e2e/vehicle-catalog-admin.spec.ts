/**
 * «Marcas y líneas» (spec 018), in a real browser against the local database. Each test brings its
 * own brands (a prefix of its own, added as save_vehicle adds them) and removes them at the end.
 *
 * - CA-01, CA-03, CA-04: the admin opens it from «Administración», filters «Por revisar», searches, and
 *   a reload keeps the address.
 * - CA-07: a renamed brand shows its new name on the customer's record.
 * - CA-12: merging a brand asks first, saying how many vehicles pass, and the merged one is gone.
 * - CA-18: a line moves to another brand.
 * - CA-05: an operator has no «Marcas y líneas» and is told they have no permission.
 * - CA-06: a customer sees the brand of their vehicle, never whether it is to review.
 * - CA-26, CA-27, CA-29: the admin registers a brand and a line, reviewed, and marks reviewed one
 *   someone typed.
 */
import { type Page, expect, test } from '@playwright/test';

import { openAdminSection } from './support/nav';
import {
  SEED,
  adminClient,
  createCustomerAccount,
  createWalkInCustomer,
  deleteCatalogBrands,
  deleteCustomers,
  deleteUsersByEmail,
  signIn,
  uniqueEmail,
  uniquePlate,
} from './support/sandbox';

const CATALOG = '/admin/vehicle-catalog';

/** A prefix of this test's own: its brands never meet another test's. */
const newPrefix = () => `E2E Cat ${Math.random().toString(36).slice(2, 8)}`;

/** A motorcycle of `customerId` with brand and line by name, as the app registers it. */
const addMotorcycle = async (customerId: string, brand: string, line: string) => {
  const { error } = await adminClient().rpc('save_vehicle', {
    p_customer_id: customerId,
    p_vehicle_type: 'motorcycle',
    p_brand_name: brand,
    p_line_name: line,
    p_color: 'black',
    p_plate: uniquePlate('motorcycle'),
  });
  if (error) throw new Error(`save_vehicle failed: ${error.message}`);
};

/** The catalog searched for this test's brands: they show with their lines (CA-04). */
const openCatalogFor = async (page: Page, prefix: string) => {
  await page.goto(`${CATALOG}?q=${encodeURIComponent(prefix)}`);
  await expect(page.getByRole('heading', { name: 'Marcas y líneas', level: 1 })).toBeVisible();
};

const chooseInDialog = async (page: Page, dialogName: string, field: string, option: string) => {
  const dialog = page.getByRole('dialog', { name: dialogName });
  await dialog.getByRole('combobox', { name: field }).fill(option);
  await page.getByRole('option', { name: option, exact: true }).click();
};

test.describe('the admin', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  let prefix: string;
  const customers: string[] = [];
  test.beforeEach(() => {
    prefix = newPrefix();
  });
  test.afterEach(async () => {
    await deleteCustomers(customers.splice(0));
    await deleteCatalogBrands(prefix);
  });

  test('opens «Marcas y líneas» from «Administración», filters «Por revisar», searches, and a reload keeps it (CA-01, CA-03, CA-04)', async ({
    page,
  }) => {
    const customer = await createWalkInCustomer(`${prefix} Cliente`);
    customers.push(customer);
    await addMotorcycle(customer, `${prefix} Zeta`, 'Uno');

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await openAdminSection(page, 'Marcas y líneas');
    await expect(page).toHaveURL(CATALOG);

    await page.getByRole('button', { name: /^Por revisar \d+$/ }).click();
    await expect(page).toHaveURL(`${CATALOG}?status=pending`);
    await page.getByRole('searchbox', { name: 'Buscar marcas y líneas' }).fill(prefix);
    await expect(page).toHaveURL(new RegExp(`status=pending&q=`));

    const brand = page.getByRole('button', { name: `Ver líneas de ${prefix} Zeta` });
    await expect(brand).toBeVisible();
    await expect(page.locator('li', { has: brand }).first()).toContainText('Por revisar ·');
    await expect(page.locator('li', { has: brand }).first()).toContainText('1 vehículo');

    await page.reload();
    await expect(page.getByRole('searchbox', { name: 'Buscar marcas y líneas' })).toHaveValue(
      prefix
    );
    await expect(page.getByRole('button', { name: /^Por revisar \d+$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(brand).toBeVisible();
  });

  test('renames a brand, and the customer’s record shows the new name (CA-07)', async ({
    page,
  }) => {
    const customer = await createWalkInCustomer(`${prefix} Cliente`);
    customers.push(customer);
    await addMotorcycle(customer, `${prefix} Viejo`, 'Uno');

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await openCatalogFor(page, prefix);
    await page.getByRole('button', { name: `Acciones de ${prefix} Viejo` }).click();
    await page.getByRole('menuitem', { name: 'Renombrar' }).click();
    const dialog = page.getByRole('dialog', { name: `Renombrar la marca «${prefix} Viejo»` });
    await dialog.getByRole('textbox', { name: 'Nombre' }).fill(`${prefix} Nuevo`);
    await dialog.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText(`Ahora se llama «${prefix} Nuevo».`)).toBeVisible();
    await page.goto(`/customers/${customer}`);
    await expect(page.getByText(`${prefix} Nuevo`).first()).toBeVisible();
  });

  test('merges a brand after saying how many vehicles pass, and the merged one is gone (CA-12)', async ({
    page,
  }) => {
    const customer = await createWalkInCustomer(`${prefix} Cliente`);
    customers.push(customer);
    await addMotorcycle(customer, `${prefix} Zeta`, 'Uno');
    await addMotorcycle(customer, `${prefix} Zetta`, 'Uno');

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await openCatalogFor(page, prefix);
    await page.getByRole('button', { name: `Acciones de ${prefix} Zetta` }).click();
    await page.getByRole('menuitem', { name: 'Unir con otra marca' }).click();
    const dialog = page.getByRole('dialog', { name: `Unir la marca «${prefix} Zetta»` });
    await chooseInDialog(
      page,
      `Unir la marca «${prefix} Zetta»`,
      'Marca que queda',
      `${prefix} Zeta`
    );
    await expect(dialog).toContainText(`1 vehículo pasa a ${prefix} Zeta.`);
    await expect(dialog).toContainText('No se puede deshacer.');
    await dialog.getByRole('button', { name: 'Unir' }).click();

    await expect(page.getByText(`«${prefix} Zetta» se unió con ${prefix} Zeta.`)).toBeVisible();
    await expect(page.getByRole('button', { name: `Ver líneas de ${prefix} Zetta` })).toHaveCount(
      0
    );
    await expect(
      page.locator('li', {
        has: page.getByRole('button', { name: `Ver líneas de ${prefix} Zeta` }),
      })
    ).toContainText('2 vehículos');
  });

  test('registers a brand and a line, reviewed, and marks reviewed a brand someone typed (CA-26, CA-27, CA-29)', async ({
    page,
  }) => {
    const customer = await createWalkInCustomer(`${prefix} Cliente`);
    customers.push(customer);
    await addMotorcycle(customer, `${prefix} Bien`, 'Uno');

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await openCatalogFor(page, prefix);

    // CA-26: a brand that is missing, reviewed and without vehicles.
    await page.getByRole('button', { name: 'Registrar marca' }).click();
    const addBrand = page.getByRole('dialog', { name: 'Registrar una marca de motocicleta' });
    await addBrand.getByRole('textbox', { name: 'Nombre' }).fill(`${prefix} Voge`);
    await addBrand.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByText(`Se registró «${prefix} Voge».`)).toBeVisible();
    const voge = page.locator('li', {
      has: page.getByRole('button', { name: `Ver líneas de ${prefix} Voge` }),
    });
    await expect(voge).toContainText('Sin vehículos');
    await expect(voge).not.toContainText('Por revisar');

    // CA-27: a line of it.
    await page.getByRole('button', { name: `Acciones de ${prefix} Voge` }).click();
    await page.getByRole('menuitem', { name: 'Registrar línea' }).click();
    const addLine = page.getByRole('dialog', { name: `Registrar una línea de ${prefix} Voge` });
    await addLine.getByRole('textbox', { name: 'Nombre' }).fill('525 Dsx');
    await addLine.getByRole('button', { name: 'Registrar' }).click();
    await expect(
      page.getByRole('list', { name: `Líneas de ${prefix} Voge` }).getByText('525 Dsx')
    ).toBeVisible();

    // CA-29: a well written brand someone typed is no longer to review.
    // The row of the brand itself (its lines, still to review, are listed under it).
    const bien = page.getByRole('button', { name: `Ver líneas de ${prefix} Bien` }).locator('..');
    await expect(bien).toContainText('Por revisar ·');
    await page.getByRole('button', { name: `Acciones de ${prefix} Bien` }).click();
    await page.getByRole('menuitem', { name: 'Dar por revisada' }).click();
    await expect(page.getByText(`«${prefix} Bien» quedó revisada.`)).toBeVisible();
    await expect(bien).not.toContainText('Por revisar ·');
    await expect(bien).toContainText('1 línea por revisar');
  });

  test('moves a line to another brand (CA-18)', async ({ page }) => {
    const customer = await createWalkInCustomer(`${prefix} Cliente`);
    customers.push(customer);
    await addMotorcycle(customer, `${prefix} Zeta`, 'Linea Movil');
    await addMotorcycle(customer, `${prefix} Omega`, 'Base');

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await openCatalogFor(page, prefix);
    await page.getByRole('button', { name: 'Acciones de la línea Linea Movil' }).click();
    await page.getByRole('menuitem', { name: 'Pasar a otra marca' }).click();
    const dialog = page.getByRole('dialog', { name: 'Pasar la línea «Linea Movil» a otra marca' });
    await chooseInDialog(
      page,
      'Pasar la línea «Linea Movil» a otra marca',
      'Marca de destino',
      `${prefix} Omega`
    );
    await dialog.getByRole('button', { name: 'Pasar' }).click();

    await expect(page.getByText(`«Linea Movil» pasó a ${prefix} Omega.`)).toBeVisible();
    await expect(
      page.getByRole('list', { name: `Líneas de ${prefix} Omega` }).getByText('Linea Movil')
    ).toBeVisible();
  });
});

test('an operator has no «Marcas y líneas» and is told they have no permission (CA-05)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await expect(
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('button', { name: 'Administración' })
  ).toHaveCount(0);

  await page.goto(CATALOG);
  await expect(page.getByText('No tienes permiso para ver esta página.')).toBeVisible();
});

test('a customer sees the brand of their vehicle, never whether it is to review (CA-06)', async ({
  page,
}) => {
  const prefix = newPrefix();
  const email = uniqueEmail('catalog-customer');
  try {
    const userId = await createCustomerAccount({ email, fullName: `${prefix} Cliente` });
    const { data: customer } = await adminClient()
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .single();
    await addMotorcycle(customer!.id, `${prefix} Propia`, 'Uno');

    await signIn(page, email);
    await expect(page).toHaveURL('/my');
    await page.goto('/profile');
    const mine = page.getByRole('region', { name: 'Mis vehículos' });
    await expect(mine.getByText(`${prefix} Propia`).first()).toBeVisible();
    await expect(page.getByText('Por revisar')).toHaveCount(0);
  } finally {
    await deleteCatalogBrands(prefix);
    await deleteUsersByEmail([email]);
  }
});
