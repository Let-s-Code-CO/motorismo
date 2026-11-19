#!/usr/bin/env node
/**
 * Creates the FIRST administrator of an environment, by invitation (spec 002, RF-06).
 *
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… \
 *     pnpm --filter @motorismo/supabase admin:bootstrap -- --email dueño@ejemplo.com --name "Nombre"
 *
 * Refuses to run when an admin (invited or active) already exists: from then on admins are
 * managed from the app. The invitation email uses the project's Site URL and templates.
 */
import { createClient } from '@supabase/supabase-js';

import { parseArgs } from 'node:util';

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

// `pnpm … admin:bootstrap -- --email …` forwards the literal `--`; drop it before parsing.
const argv = process.argv.slice(2);
const { values } = parseArgs({
  args: argv[0] === '--' ? argv.slice(1) : argv,
  options: { email: { type: 'string' }, name: { type: 'string' } },
});

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();

if (!url || !secretKey) fail('Set SUPABASE_URL and SUPABASE_SECRET_KEY.');
if (!email || !email.includes('@')) fail('Pass a valid --email.');
if (!name) fail('Pass --name.');

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { count, error: countError } = await supabase
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('role', 'admin')
  .neq('status', 'disabled');

if (countError) fail(`Could not read profiles: ${countError.message}`);
if ((count ?? 0) > 0) fail('An admin already exists. Manage users from the app instead.');

const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name: name, role: 'admin' },
});

if (error) fail(`Invitation failed: ${error.message}`);

console.log(`✓ Invited ${data.user.email} as the first admin. They must open the email link.`);
