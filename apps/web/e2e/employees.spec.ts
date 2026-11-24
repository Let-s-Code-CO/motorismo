/**
 * «Empleados» (spec 007, HU-02 to HU-04), with the local seeds (seeds/04_catalogs.sql).
 *
 * - CA-07: an admin registers an employee with document, phone and commission.
 * - CA-09: the same document typed with dots is refused.
 * - CA-10: an admin corrects the commission.
 * - CA-12 / CA-13: disabling asks first and moves the employee to «Desactivados», from where they
 *   come back.
 * - Spec 016, CA-01: the base salary is set on registering and corrected, and shows in the list.
 * - CA-16 / RN-07: an operator sees only the names of the active employees.
 * - Spec 016, CA-04: nor their base salary.
 */
import { type Page, expect, test } from '@playwright/test';

import { chooseRowAction } from './support/menus';
import { SEED, adminClient, signIn } from './support/sandbox';

const name = `E2E Empleado ${Date.now()}`;
// Eight random digits: a cédula nobody else has.
const document = String(10_000_000 + Math.floor(Math.random() * 89_999_999));
const withDots = document.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

test.afterAll(async () => {
  const { data } = await adminClient().from('employees').select('id').eq('full_name', name);
  const ids = (data ?? []).map(({ id }) => id);
  if (!ids.length) return;
  // The active periods of the payroll (spec 016) point at the employee.
  await adminClient().from('employee_active_periods').delete().in('employee_id', ids);
  await adminClient().from('employee_details').delete().in('employee_id', ids);
  await adminClient().from('employees').delete().in('id', ids);
});

const openEmployees = async (page: Page, email: string) => {
  await signIn(page, email);
  await expect(page).toHaveURL('/');
  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: 'Empleados', level: 1 })).toBeVisible();
};

const rowOf = (page: Page, text: string) => page.getByRole('row', { name: new RegExp(text) });

const chooseAction = (page: Page, employee: string, item: string) =>
  chooseRowAction(page, employee, item);

test('an admin registers, corrects, disables and reactivates an employee (CA-07, CA-09, CA-10, CA-12, CA-13; spec 016, CA-01)', async ({
  page,
}) => {
  await openEmployees(page, SEED.admin.email);

  // CA-07: register (a cédula by default).
  await page.getByRole('button', { name: 'Nuevo empleado' }).click();
  let dialog = page.getByRole('dialog', { name: /Nuevo empleado/ });
  await dialog.getByLabel('Nombre completo').fill(name);
  await dialog.getByLabel('Número de documento').fill(document);
  await dialog.getByLabel('Celular (opcional)').fill('310 555 6677');
  await dialog.getByLabel('Comisión').fill('30');
  await dialog.getByLabel('Salario base').fill('1.300.000');
  await dialog.getByRole('button', { name: 'Registrar empleado' }).click();
  await expect(page.getByText('Empleado registrado.')).toBeVisible();
  await expect(rowOf(page, name)).toContainText(`CC ${document}`);
  await expect(rowOf(page, name)).toContainText('30 %');
  await expect(rowOf(page, name)).toContainText('$ 1.300.000');

  // CA-09: the same document with dots is taken.
  await page.getByRole('button', { name: 'Nuevo empleado' }).click();
  dialog = page.getByRole('dialog', { name: /Nuevo empleado/ });
  await dialog.getByLabel('Nombre completo').fill('Otra Persona');
  await dialog.getByLabel('Número de documento').fill(withDots);
  await dialog.getByLabel('Comisión').fill('10');
  await dialog.getByLabel('Salario base').fill('0');
  await dialog.getByRole('button', { name: 'Registrar empleado' }).click();
  await expect(dialog.getByText('Ya existe un empleado con ese documento.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();

  // CA-10: correct the commission; spec 016, CA-01: and the base salary.
  await chooseAction(page, name, 'Editar');
  dialog = page.getByRole('dialog', { name: /Editar empleado/ });
  await expect(dialog.getByLabel('Salario base')).toHaveValue('1.300.000');
  await dialog.getByLabel('Comisión').fill('40');
  await dialog.getByLabel('Salario base').fill('1.400.000');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Empleado actualizado.')).toBeVisible();
  await expect(rowOf(page, name)).toContainText('40 %');
  await expect(rowOf(page, name)).toContainText('$ 1.400.000');

  // CA-12: disabling asks first.
  await chooseAction(page, name, 'Desactivar');
  const confirm = page.getByRole('dialog', { name: new RegExp(`¿Desactivar a «${name}»?`) });
  await confirm.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByText('Empleado desactivado.')).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Empleados activos' })).not.toContainText(name);

  // CA-13: back from «Desactivados».
  await page.getByRole('button', { name: /^Desactivados \(\d+\)$/ }).click();
  await expect(
    page
      .getByRole('grid', { name: 'Empleados desactivados' })
      .getByRole('row', { name: new RegExp(name) })
  ).toContainText('Desactivado el');
  await chooseAction(page, name, 'Reactivar');
  await expect(page.getByText('Empleado reactivado.')).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Empleados activos' })).toContainText(name);
});

test('an operator sees only the names of the active employees (CA-16, RN-07; spec 016, CA-04)', async ({
  page,
}) => {
  await openEmployees(page, SEED.operator.email);

  await expect(rowOf(page, 'Elkin Estrada')).toBeVisible();
  await expect(page.getByText('1020304050')).toHaveCount(0);
  await expect(page.getByText('35 %')).toHaveCount(0);
  await expect(page.getByText('$ 1.423.500')).toHaveCount(0);
  await expect(page.getByText('Diego Desactivado')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nuevo empleado' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Acciones de/ })).toHaveCount(0);
});
