import { createClient } from '@supabase/supabase-js';

import { type Page, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { Database } from '@motorismo/supabase/types';

/** Staff seed users from packages/supabase/supabase/seeds/01_users.sql. */
export const SEED = {
  password: 'motorismo-local',
  admin: { email: 'sebastian.pulido@motorismo.test', name: 'Sebastián Pulido' },
  secondAdmin: { email: 'carlos.diaz@motorismo.test', name: 'Carlos Díaz' },
  operator: { email: 'operador@motorismo.test', name: 'Óscar Operador' },
  disabled: { email: 'desactivado@motorismo.test', name: 'Diana Desactivada' },
} as const;

/** Seed customers from packages/supabase/supabase/seeds/02_customers.sql (spec 004). */
export const SEED_CUSTOMERS = {
  /** With account (own sign-up): the local test customer. */
  customer: { email: 'cliente@motorismo.test', name: 'Camila Cliente' },
  google: { email: 'cliente.google@motorismo.test', name: 'Gabriel Gómez' },
  disabled: { email: 'cliente.desactivado@motorismo.test', name: 'Daniel Desactivado' },
  /** Without account, registered at the counter by the first admin. */
  walkIn: {
    email: 'valentina.vasquez@correo.test',
    name: 'Valentina Vásquez',
    phone: '315 765 4321',
  },
  phoneOnly: { name: 'Andrés Ñáñez' },
} as const;

const readStatus = () => {
  const supabaseDir = fileURLToPath(new URL('../../../../packages/supabase', import.meta.url));
  const raw = execFileSync('./node_modules/.bin/supabase', ['status', '-o', 'json'], {
    cwd: supabaseDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
};

const status = readStatus();
const MAILPIT_URL = status.MAILPIT_URL ?? 'http://127.0.0.1:54324';

/** Public client, as a visitor's browser would create it. */
export const publicClient = () =>
  createClient<Database>(status.API_URL!, status.PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Secret-key client for setup and cleanup only. */
export const adminClient = () =>
  createClient<Database>(status.API_URL!, status.SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@motorismo.test`;

export const deleteUsersByEmail = async (emails: string[]) => {
  const admin = adminClient();
  await admin.from('staff_invitations').delete().in('email', emails);
  // Customers (with or without account) first: an account with a customer cannot be deleted.
  await admin.from('customers').delete().in('email', emails);
  const { data } = await admin.from('profiles').select('id').in('email', emails);
  for (const { id } of data ?? []) {
    await admin.from('profiles').delete().eq('id', id);
  }
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of users?.users ?? []) {
    if (user.email && emails.includes(user.email)) await admin.auth.admin.deleteUser(user.id);
  }
};

/** How many emails Mailpit received for `to` (e.g. to prove that none was sent). */
export const emailCountFor = async (to: string) => {
  const search = await fetch(
    `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`
  );
  const { messages } = (await search.json()) as { messages: unknown[] };
  return messages.length;
};

/** The /auth/confirm link of the newest email sent to `to`, as a path for page.goto. */
export const confirmLinkFromEmail = async (to: string) => {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`
        );
        const { messages } = (await search.json()) as { messages: { ID: string }[] };
        if (!messages[0]) return undefined;
        const message = (await (
          await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)
        ).json()) as {
          HTML: string;
        };
        link = /href="([^"]*\/auth\/confirm[^"]*)"/
          .exec(message.HTML)?.[1]
          ?.replaceAll('&amp;', '&');
        return link;
      },
      { message: `waiting for an email to ${to}`, timeout: 15_000 }
    )
    .toBeTruthy();
  const url = new URL(link!);
  return url.pathname + url.search;
};

export const signIn = async (page: Page, email: string, password: string = SEED.password) => {
  await page.goto('/auth/login');
  await page.getByLabel('Correo').fill(email);
  // exact: the show/hide toggle is labelled "Mostrar contraseña".
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
};

/** An active user with a known password, created like an accepted invitation. */
export const createActiveUser = async ({
  email,
  fullName,
  password = SEED.password,
}: {
  email: string;
  fullName: string;
  password?: string;
}) => {
  const admin = adminClient();
  // Staff only come from a pending invitation (spec 004): never from the sign-up metadata.
  await admin.from('staff_invitations').insert({ email, full_name: fullName, role: 'operator' });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createUser failed: ${error.code}`);
  await admin.from('profiles').update({ status: 'active' }).eq('id', data.user.id);
  return data.user.id;
};

/** A customer with a confirmed account, as if they had signed up and opened the email (spec 004). */
export const createCustomerAccount = async ({
  email,
  fullName,
  phone,
  password = SEED.password,
}: {
  email: string;
  fullName: string;
  phone?: string;
  password?: string;
}) => {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone, data_consent: true },
  });
  if (error) throw new Error(`createUser failed: ${error.code}`);
  return data.user.id;
};
