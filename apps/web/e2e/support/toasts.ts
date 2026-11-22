import { type Page, expect } from '@playwright/test';

import { SEED, adminClient, createWalkInCustomer, deleteCustomers } from './sandbox';

/** The floating notices (spec 013). */
export const toastRegion = (page: Page) => page.getByRole('region', { name: 'Avisos' });

/** One floating notice, by its text. */
export const toast = (page: Page, text: string) =>
  toastRegion(page).locator('[data-toast]').filter({ hasText: text });

export const SETTINGS_SAVED = 'Configuración guardada.';
export const NO_SHOW_REFUSED = 'El cliente aún puede llegar: espera a que pase su tolerancia.';

/** «Horario» → «Guardar configuración» (same values), from the bottom of the page. */
export const saveAgendaSettings = async (page: Page) => {
  await page.goto('/agenda/schedule');
  const save = page.getByRole('button', { name: 'Guardar configuración' });
  await save.scrollIntoViewIfNeeded();
  await save.click();
  await expect(toast(page, SETTINGS_SAVED)).toBeVisible();
};

/**
 * A real refusal of a standalone action (spec 013, CA-07): a reservation past its tolerance offers
 * «No asistió»; meanwhile its tolerance grows, so the server refuses it. Realtime is cut for the
 * page, so the screen does not refresh before the click. Staff must be signed in. Returns the
 * cleanup.
 */
export const refuseNoShow = async (page: Page) => {
  const admin = adminClient();
  const customerId = await createWalkInCustomer(`E2E Aviso ${Date.now()}`);
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', SEED.admin.email)
    .single();
  const start = new Date(Date.now() - 30 * 60_000);
  const { data: reservation, error } = await admin
    .from('reservations')
    .insert({
      customer_id: customerId,
      slot_start: start.toISOString(),
      slot_end: new Date(start.getTime() + 60 * 60_000).toISOString(),
      created_by: profile!.id,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await page.routeWebSocket(/realtime/, () => {});
  await page.goto(`/agenda/${reservation.id}`);
  const noShow = page.getByRole('button', { name: 'No asistió' });
  await expect(noShow).toBeVisible();
  await admin.from('reservations').update({ tolerance_minutes: 60 }).eq('id', reservation.id);
  await noShow.click();
  await expect(toast(page, NO_SHOW_REFUSED)).toBeVisible();

  return async () => {
    await admin.from('reservations').delete().eq('id', reservation.id);
    await deleteCustomers([customerId]);
  };
};
