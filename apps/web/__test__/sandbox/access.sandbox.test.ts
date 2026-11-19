/**
 * Access control seen from the public API (spec 002).
 *
 * Guards:
 * - CA-09: an operator who bypasses the UI and calls the API directly with their own session can
 *   only read their own profile and cannot change anyone's role (RLS).
 * - RN-01 / CA-27: public sign-up is disabled, so nobody (including an unknown Google account)
 *   can create a user by themselves.
 * - RF-06: the first-admin script refuses to run once an admin exists.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inject } from 'vitest';

import { SEED, adminClient, publicClient, signedInAs, uniqueEmail } from './support/sandbox';

describe('an operator calling the API directly (CA-09)', () => {
  it('only reads their own profile', async () => {
    const { client, userId } = await signedInAs(SEED.operator);

    const { data, error } = await client.from('profiles').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([{ id: userId }]);
  });

  it('cannot promote anyone, themselves included: no row changes', async () => {
    const { client, userId } = await signedInAs(SEED.operator);
    const { data: admin } = await adminClient()
      .from('profiles')
      .select('id')
      .eq('email', SEED.admin)
      .single();

    const others = await client
      .from('profiles')
      .update({ role: 'operator' })
      .eq('id', admin!.id)
      .select();
    const own = await client.from('profiles').update({ role: 'admin' }).eq('id', userId).select();

    expect(others.data).toEqual([]);
    expect(own.data).toEqual([]);
    const { data: stillOperator } = await adminClient()
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    expect(stillOperator?.role).toBe('operator');
  });
});

describe('public sign-up (RN-01, CA-27)', () => {
  it('is rejected with signup_disabled and creates no user', async () => {
    const email = uniqueEmail('signup');

    const { error } = await publicClient().auth.signUp({ email, password: 'motorismo-local' });

    expect(error?.code).toBe('signup_disabled');
    const { count } = await adminClient()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('email', email);
    expect(count).toBe(0);
  });
});

describe('first-admin script (RF-06)', () => {
  it('refuses to invite when an admin already exists', () => {
    const { url, secretKey } = inject('sandbox');
    const supabaseDir = fileURLToPath(new URL('../../../../packages/supabase', import.meta.url));

    let output = '';
    let exitCode = 0;
    try {
      execFileSync(
        'node',
        ['scripts/bootstrap-admin.mjs', '--email', 'otro@motorismo.test', '--name', 'Otro'],
        {
          cwd: supabaseDir,
          env: { ...process.env, SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
    } catch (error) {
      const failure = error as { status: number; stderr: string };
      exitCode = failure.status;
      output = failure.stderr;
    }

    expect(exitCode).toBe(1);
    expect(output).toContain('An admin already exists');
  });
});
