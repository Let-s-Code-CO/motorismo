import { createClient } from '@supabase/supabase-js';

import { type Page, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import type { Database } from '@motorismo/supabase/types';

/** Seed users from packages/supabase/supabase/seeds/01_users.sql. */
export const SEED = {
  password: 'motorismo-local',
  admin: { email: 'admin@motorismo.test', name: 'Ana Administradora' },
  operator: { email: 'operador@motorismo.test', name: 'Óscar Operador' },
  disabled: { email: 'desactivado@motorismo.test', name: 'Diana Desactivada' },
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

/** Secret-key client for setup and cleanup only. */
export const adminClient = () =>
  createClient<Database>(status.API_URL!, status.SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const uniqueEmail = (label: string) =>
  `e2e-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@motorismo.test`;

export const deleteUsersByEmail = async (emails: string[]) => {
  const admin = adminClient();
  const { data } = await admin.from('profiles').select('id').in('email', emails);
  for (const { id } of data ?? []) {
    await admin.from('profiles').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
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
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'operator' },
  });
  if (error) throw new Error(`createUser failed: ${error.code}`);
  await admin.from('profiles').update({ status: 'active' }).eq('id', data.user.id);
  return data.user.id;
};
