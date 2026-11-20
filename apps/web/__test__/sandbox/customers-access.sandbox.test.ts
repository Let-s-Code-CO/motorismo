/**
 * What a customer can reach through the public API with their own session (spec 004, HU-02).
 *
 * Guards CA-10: a customer who bypasses the UI only reads their own customer record, cannot read
 * staff profiles, cannot change their status or email, cannot create customers, cannot change
 * another customer, and cannot probe which emails exist (email_in_use is server-only, RN-06).
 * Also RN-09 / CA-31: an operator calling the API directly disables and reactivates a customer; a
 * customer cannot disable an account, not even their own.
 */
import { SEED, adminClient, signedInAs } from './support/sandbox';

describe('a customer calling the API directly (CA-10)', () => {
  it('only reads their own customer record', async () => {
    const { client, userId } = await signedInAs(SEED.customer);

    const { data, error } = await client.from('customers').select('user_id');

    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: userId }]);
  });

  it('cannot read staff profiles', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { data } = await client.from('profiles').select('id');

    expect(data).toEqual([]);
  });

  it('cannot disable themselves nor change their email', async () => {
    const { client, userId } = await signedInAs(SEED.customer);

    const status = await client
      .from('customers')
      .update({ disabled_at: new Date().toISOString() })
      .eq('user_id', userId);
    const email = await client
      .from('customers')
      .update({ email: 'otro@correo.test' })
      .eq('user_id', userId);

    expect(status.error?.code).toBe('42501');
    expect(email.error?.code).toBe('42501');
  });

  it('cannot create customers', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { error } = await client
      .from('customers')
      .insert({ full_name: 'Falso', phone: '3000000000' });

    expect(error?.code).toBe('42501');
  });

  it('cannot change another customer: no row changes', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { data } = await client
      .from('customers')
      .update({ full_name: 'Hackeado' })
      .eq('email', 'valentina.vasquez@correo.test')
      .select();

    expect(data).toEqual([]);
    const { data: other } = await adminClient()
      .from('customers')
      .select('full_name')
      .eq('email', 'valentina.vasquez@correo.test')
      .single();
    expect(other?.full_name).toBe('Valentina Vásquez');
  });

  it('cannot ask whether an email is registered', async () => {
    const { client } = await signedInAs(SEED.customer);

    const { error } = await client.rpc('email_in_use', { p_email: SEED.admin });

    expect(error?.code).toBe('42501');
  });
});

describe('disabling through the API directly (RN-09, CA-29 to CA-31)', () => {
  it('lets an operator disable and reactivate a customer (RN-09)', async () => {
    const { client } = await signedInAs(SEED.operator);
    const status = async () =>
      (
        await adminClient()
          .from('customers')
          .select('status')
          .eq('email', 'valentina.vasquez@correo.test')
          .single()
      ).data?.status;

    const disabled = await client
      .from('customers')
      .update({ disabled_at: new Date().toISOString() })
      .eq('email', 'valentina.vasquez@correo.test');
    expect(disabled.error).toBeNull();
    expect(await status()).toBe('disabled');

    const reactivated = await client
      .from('customers')
      .update({ disabled_at: null })
      .eq('email', 'valentina.vasquez@correo.test');
    expect(reactivated.error).toBeNull();
    expect(await status()).toBe('walk_in');
  });

  it('refuses a customer disabling their own account (CA-31)', async () => {
    const { client, userId } = await signedInAs(SEED.customer);

    const { error } = await client
      .from('customers')
      .update({ disabled_at: new Date().toISOString() })
      .eq('user_id', userId);

    expect(error?.code).toBe('42501');
  });
});
