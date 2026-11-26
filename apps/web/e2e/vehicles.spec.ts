/**
 * Staff register the vehicles of a customer on their record (spec 005, HU-01 / HU-03).
 *
 * Guards CA-01 (the "Vehículos" section, empty at first), CA-02 (Motocicleta preselected), CA-03
 * (a motorcycle with its displacement, colour and plate shown with a hyphen), CA-04 (several
 * vehicles, newest first), CA-05 (a car with its class and an ABC-123 plate), CA-06 (a bicycle
 * without plate) and CA-08 (a plate with an active vehicle of another customer is refused); and
 * HU-07: the plate drawn like a Colombian one — a car's with its issuing city, Bogotá, D.C. by
 * default (CA-27, CA-30), a motorcycle's with "COLOMBIA" — and a car's city chosen by typing and
 * corrected (CA-20, CA-30).
 * Each test works on its own counter customer (tests run in parallel workers).
 */
import { type Locator, type Page, expect, test } from '@playwright/test';

import {
  SEED,
  createWalkInCustomer,
  deleteCustomers,
  shownPlate,
  signIn,
  uniquePlate,
} from './support/sandbox';

const created: string[] = [];

test.afterAll(async () => {
  await deleteCustomers(created);
});

/** A new counter customer of this test, and their record open ("Vehículos" section). */
const openRecordOfNewCustomer = async (page: Page, label: string, { signedIn = false } = {}) => {
  const id = await createWalkInCustomer(`E2E Vehículos ${label} ${Date.now()}`);
  created.push(id);
  if (!signedIn) {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
  }
  await page.goto(`/customers/${id}`);
  return page.getByRole('region', { name: 'Vehículos' });
};

const openForm = async (page: Page, section: Locator) => {
  await section.getByRole('button', { name: 'Agregar vehículo' }).click();
  return page.getByRole('dialog', { name: 'Agregar vehículo' });
};

/** Types in a brand/line field and picks the suggestion; without one, Tab keeps the typed name. */
const pick = async (page: Page, dialog: Locator, field: string, typed: string, option?: string) => {
  await dialog.getByRole('combobox', { name: field }).fill(typed);
  if (option) await page.getByRole('option', { name: option, exact: true }).click();
  else await page.keyboard.press('Tab');
};

const chooseColor = async (page: Page, dialog: Locator, color: string) => {
  await dialog.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: color, exact: true }).click();
};

test('registers a motorcycle, a car and a bicycle; the newest is listed first (CA-01 to CA-06)', async ({
  page,
}) => {
  const motoPlate = uniquePlate('motorcycle');
  const carPlate = uniquePlate('car');
  const section = await openRecordOfNewCustomer(page, 'tres');
  await expect(section.getByText('Este cliente aún no tiene vehículos.')).toBeVisible();

  // A motorcycle: Motocicleta comes chosen (CA-02); the plate is typed in lowercase (CA-03).
  let dialog = await openForm(page, section);
  await expect(dialog.getByRole('radio', { name: 'Motocicleta' })).toBeChecked();
  await pick(page, dialog, 'Marca', 'Suzuki', 'Suzuki');
  await pick(page, dialog, 'Línea', 'GSX-R600', 'GSX-R600');
  await dialog.getByLabel('Cilindraje (opcional)').fill('600');
  await chooseColor(page, dialog, 'Negro');
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(motoPlate.toLowerCase());
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Vehículo agregado.')).toBeVisible();

  const list = section.getByRole('list', { name: 'Vehículos' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  const moto = list.getByRole('listitem').first();
  await expect(moto).toContainText('Suzuki GSX-R600');
  await expect(moto).toContainText('600 cc');
  await expect(moto).toContainText('Negro');
  await expect(moto).toContainText(shownPlate(motoPlate));
  // CA-27: a motorcycle plate says COLOMBIA (drawn: spec 023 keeps it in the plate's legend).
  await expect(moto.locator('[data-plate]')).toHaveAttribute('data-legend', 'COLOMBIA');

  // A car (CA-05): its class, no displacement, a plate of three letters and three digits.
  dialog = await openForm(page, section);
  await dialog.getByRole('radio', { name: 'Carro' }).check();
  await expect(dialog.getByLabel('Cilindraje (opcional)')).toHaveCount(0);
  // CA-30: the plate city comes with Bogotá, D.C.
  await expect(dialog.getByRole('combobox', { name: 'Ciudad de la placa' })).toHaveValue(
    'Bogotá, D.C.'
  );
  await dialog.getByRole('radio', { name: 'Camioneta' }).check();
  await pick(page, dialog, 'Marca', 'Mazda', 'Mazda');
  await pick(page, dialog, 'Línea', 'CX-30', 'CX-30');
  await chooseColor(page, dialog, 'Gris');
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(carPlate);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(2);

  // A bicycle (CA-06): no plate field; registered without plate.
  dialog = await openForm(page, section);
  await dialog.getByRole('radio', { name: 'Bicicleta' }).check();
  await expect(dialog.getByRole('textbox', { name: 'Placa' })).toHaveCount(0);
  await dialog.getByRole('radio', { name: 'Ruta' }).check();
  await pick(page, dialog, 'Marca', 'GW', 'GW');
  await chooseColor(page, dialog, 'Multicolor');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(list.getByRole('listitem')).toHaveCount(3);

  // Newest first (CA-04): bicycle, car, motorcycle.
  const items = list.getByRole('listitem');
  await expect(items.nth(0)).toContainText('GW');
  await expect(items.nth(0)).toContainText('Ruta');
  await expect(items.nth(0)).toContainText('Sin placa');
  await expect(items.nth(1)).toContainText('Mazda CX-30');
  await expect(items.nth(1)).toContainText('Camioneta');
  await expect(items.nth(1)).toContainText(shownPlate(carPlate));
  // CA-27: the car plate shows its city (drawn in capitals without accents, spec 023, RN-05).
  await expect(items.nth(1).locator('[data-plate]')).toHaveAttribute('data-legend', 'BOGOTA, D.C.');
  await expect(items.nth(2)).toContainText('Suzuki GSX-R600');
});

test('registers a car from Medellín typing "medellin", and corrects its plate city to Funza (CA-20, CA-27, CA-30)', async ({
  page,
}) => {
  const plate = uniquePlate('car');
  const section = await openRecordOfNewCustomer(page, 'ciudad');

  const dialog = await openForm(page, section);
  await dialog.getByRole('radio', { name: 'Carro' }).check();
  await dialog.getByRole('radio', { name: 'Automóvil' }).check();
  await pick(page, dialog, 'Marca', 'Renault', 'Renault');
  await pick(page, dialog, 'Línea', 'Logan', 'Logan');
  await chooseColor(page, dialog, 'Blanco');
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(plate);
  const city = dialog.getByRole('combobox', { name: 'Ciudad de la placa' });
  await city.fill('medellin');
  // Each option shows its department below the name.
  await expect(page.getByRole('option', { name: /Medellín/ })).toContainText('Antioquia');
  await page.getByRole('option', { name: /Medellín/ }).click();
  await expect(city).toHaveValue('Medellín');
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  const car = section.getByRole('list', { name: 'Vehículos' }).getByRole('listitem').first();
  await expect(car).toContainText(shownPlate(plate));
  // Spec 023, RN-05: drawn without accents, read aloud with them.
  await expect(car.locator('[data-plate]')).toHaveAttribute('data-legend', 'MEDELLIN');
  await expect(car).toContainText('Medellín');

  // Correct the city (CA-20): the edit form shows the car's own city, and saves the new one.
  await section.getByRole('button', { name: /^Editar Renault Logan/ }).click();
  const edit = page.getByRole('dialog', { name: 'Editar vehículo' });
  const editCity = edit.getByRole('combobox', { name: 'Ciudad de la placa' });
  await expect(editCity).toHaveValue('Medellín');
  await editCity.fill('funza');
  await page.getByRole('option', { name: /Funza/ }).click();
  await edit.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Vehículo actualizado.')).toBeVisible();
  await expect(car.locator('[data-plate]')).toHaveAttribute('data-legend', 'FUNZA');
});

test('refuses a plate that an active vehicle of another customer has (CA-08)', async ({ page }) => {
  const section = await openRecordOfNewCustomer(page, 'placa');

  const dialog = await openForm(page, section);
  await pick(page, dialog, 'Marca', 'Yamaha', 'Yamaha');
  await pick(page, dialog, 'Línea', 'NMAX 155', 'NMAX 155');
  await chooseColor(page, dialog, 'Azul');
  // UIH-03D is Camila's GSX-R600 (seeds), written another way.
  await dialog.getByRole('textbox', { name: 'Placa' }).fill('uih 03d');
  await dialog.getByRole('button', { name: 'Guardar' }).click();

  await expect(dialog.getByText('Ya hay un vehículo registrado con esta placa.')).toBeVisible();
  await expect(dialog.getByText('Camila')).toHaveCount(0);
});

test('corrects a vehicle, refuses a taken plate, and retires it freeing the plate (CA-20 to CA-22)', async ({
  page,
}) => {
  const plate = uniquePlate('motorcycle');
  const newPlate = uniquePlate('motorcycle');
  const section = await openRecordOfNewCustomer(page, 'retiro');

  let dialog = await openForm(page, section);
  await pick(page, dialog, 'Marca', 'Honda', 'Honda');
  await pick(page, dialog, 'Línea', 'CB 190R', 'CB 190R');
  await chooseColor(page, dialog, 'Rojo');
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(plate);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Vehículo agregado.')).toBeVisible();

  // Correct it (CA-20): a taken plate is refused, a free one is saved with the new colour.
  await section.getByRole('button', { name: 'Editar Honda CB 190R' }).click();
  dialog = page.getByRole('dialog', { name: 'Editar vehículo' });
  await expect(dialog.getByRole('textbox', { name: 'Placa' })).toHaveValue(shownPlate(plate));
  await dialog.getByRole('textbox', { name: 'Placa' }).fill('UIH-03D');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog.getByText('Ya hay un vehículo registrado con esta placa.')).toBeVisible();
  await chooseColor(page, dialog, 'Morado');
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(newPlate);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Vehículo actualizado.')).toBeVisible();
  const vehicle = section.getByRole('list', { name: 'Vehículos' }).getByRole('listitem').first();
  await expect(vehicle).toContainText('Morado');
  await expect(vehicle).toContainText(shownPlate(newPlate));

  // Retire it (CA-21), after the confirmation.
  await section.getByRole('button', { name: 'Retirar Honda CB 190R' }).click();
  const confirm = page.getByRole('dialog', { name: 'Retirar vehículo' });
  await expect(confirm).toContainText('No se puede deshacer.');
  await confirm.getByRole('button', { name: 'Retirar' }).click();
  await expect(page.getByText('Vehículo retirado.')).toBeVisible();
  await expect(section.getByText('Este cliente aún no tiene vehículos.')).toBeVisible();

  // Apart, with its date and without actions (CA-22, RF-06).
  await section.getByRole('button', { name: 'Vehículos retirados (1)' }).click();
  const retired = section.getByRole('list', { name: 'Vehículos retirados (1)' });
  await expect(retired).toContainText('Honda CB 190R');
  await expect(retired).toContainText(/Retirado el \d+ de \w+ de \d{4}/);
  await expect(retired.getByRole('button')).toHaveCount(0);

  // Its plate is free: another customer registers it (CA-21, RN-04).
  const other = await openRecordOfNewCustomer(page, 'nuevo-dueño', { signedIn: true });
  dialog = await openForm(page, other);
  await pick(page, dialog, 'Marca', 'Honda', 'Honda');
  await pick(page, dialog, 'Línea', 'CB 190R', 'CB 190R');
  await chooseColor(page, dialog, 'Morado');
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(newPlate);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(other.getByRole('list', { name: 'Vehículos' })).toContainText(shownPlate(newPlate));
});
