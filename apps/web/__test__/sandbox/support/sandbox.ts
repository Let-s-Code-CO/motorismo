import { type SupabaseClient, createClient } from '@supabase/supabase-js';

import { inject } from 'vitest';

import type { Database } from '@motorismo/supabase/types';

/** Seed users from packages/supabase/supabase/seeds/01_users.sql and 02_customers.sql. */
export const SEED = {
  password: 'motorismo-local',
  admin: 'sebastian.pulido@motorismo.test',
  operator: 'operador@motorismo.test',
  disabled: 'desactivado@motorismo.test',
  /** Seed customer with an account (seeds/02_customers.sql). */
  customer: 'cliente@motorismo.test',
  disabledCustomer: 'cliente.desactivado@motorismo.test',
} as const;

const config = () => inject('sandbox');

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Secret-key client: bypasses RLS; for setup, cleanup and Auth admin calls only. */
export const adminClient = (): SupabaseClient<Database> =>
  createClient<Database>(config().url, config().secretKey, options);

/** Public client, as the browser would create it. */
export const publicClient = (): SupabaseClient<Database> =>
  createClient<Database>(config().url, config().publishableKey, options);

/** A public client signed in as the given user. */
export const signedInAs = async (email: string, password: string = SEED.password) => {
  const client = publicClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in as ${email} failed: ${error.code}`);
  return { client, userId: data.user.id };
};

/** A unique, recognisable email so suites never collide with seeds or each other. */
export const uniqueEmail = (label: string) =>
  `sandbox-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@motorismo.test`;

/** Removes users and customers created by a suite (rows first: the app never deletes them). */
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

type MailpitSummary = { ID: string; Subject: string; Created: string };

/** Waits for the newest email sent to `to` (optionally newer than `after`) and returns it. */
export const waitForEmail = async (to: string, { after }: { after?: string } = {}) => {
  const base = config().mailpitUrl;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const response = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await response.json()) as { messages: MailpitSummary[] };
    const newest = messages[0];
    if (newest && (!after || newest.ID !== after)) {
      const message = (await (await fetch(`${base}/api/v1/message/${newest.ID}`)).json()) as {
        ID: string;
        Subject: string;
        HTML: string;
      };
      return message;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email for ${to}`);
};

/** Extracts token_hash and type from the /auth/confirm link of an Auth email. */
export const confirmLinkOf = (html: string) => {
  const href = /href="([^"]*\/auth\/confirm[^"]*)"/.exec(html)?.[1];
  if (!href) throw new Error('No /auth/confirm link in the email');
  const url = new URL(href.replaceAll('&amp;', '&'));
  return {
    url,
    tokenHash: url.searchParams.get('token_hash')!,
    type: url.searchParams.get('type')!,
  };
};

/** An active user with a known password, created like an accepted invitation. */
export const createActiveUser = async ({
  email,
  fullName,
  role = 'operator',
  password = SEED.password,
}: {
  email: string;
  fullName: string;
  role?: 'operator' | 'admin';
  password?: string;
}) => {
  const admin = adminClient();
  // Staff only come from a pending invitation (spec 004): never from the sign-up metadata.
  await admin.from('staff_invitations').insert({ email, full_name: fullName, role });
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
