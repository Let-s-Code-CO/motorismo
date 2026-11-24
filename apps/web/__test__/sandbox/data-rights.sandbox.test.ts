/**
 * Erasing a customer's data through the real API (spec 017, HU-03), against the local Supabase:
 * the function runs as the admin's own session, through PostgREST, and removes the account from
 * Auth in the same transaction (pgTAP checks the rows; this, that Auth agrees).
 *
 * Guards:
 * - CA-12 / RN-05: once erased, the customer cannot sign in any more, and their email is free:
 *   it can sign up again, as a new customer.
 * - CA-05: the customer asks for the erasure from their own session.
 */
import { SEED, adminClient, publicClient, signedInAs, uniqueEmail } from './support/sandbox';

const email = uniqueEmail('erase');
const customers: string[] = [];

afterAll(async () => {
  const admin = adminClient();
  await admin.from('data_requests').delete().in('customer_id', customers);
  await admin.from('vehicles').delete().in('customer_id', customers);
  await admin.from('customers').delete().in('id', customers);
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email === email) await admin.auth.admin.deleteUser(user.id);
  }
});

const createCustomer = async () => {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: SEED.password,
    email_confirm: true,
    user_metadata: { full_name: 'Sandbox Suprimible', data_consent: true },
  });
  if (error) throw new Error(`createUser failed: ${error.code}`);
  const { data: customer } = await adminClient()
    .from('customers')
    .select('id')
    .eq('user_id', data.user.id)
    .single();
  customers.push(customer!.id);
  return customer!.id;
};

describe('erasing a customer through the API (spec 017)', () => {
  it('leaves the customer unable to sign in, with their email free to sign up again (CA-12, RN-05)', async () => {
    const customerId = await createCustomer();

    // CA-05: they ask for it.
    const { client: customer } = await signedInAs(email);
    const asked = await customer.rpc('request_data_change', { p_kind: 'erasure' });
    expect(asked.error).toBeNull();

    // CA-12: the admin erases, through the API.
    const { client: admin } = await signedInAs(SEED.admin);
    const erased = await admin.rpc('erase_customer_data', { p_request_id: asked.data! });
    expect(erased.error).toBeNull();

    const { error: signInError } = await publicClient().auth.signInWithPassword({
      email,
      password: SEED.password,
    });
    expect(signInError?.code).toBe('invalid_credentials');

    const { data: row } = await adminClient()
      .from('customers')
      .select('full_name, email, user_id')
      .eq('id', customerId)
      .single();
    expect(row).toEqual({ full_name: 'Cliente suprimido', email: null, user_id: null });

    // Their email is free again: a new sign-up is a new customer.
    const again = await createCustomer();
    expect(again).not.toBe(customerId);
  });
});

describe('changing a customer’s email through Auth’s admin API (spec 017, CA-11)', () => {
  const before = uniqueEmail('email-before');
  const after = uniqueEmail('email-after');

  afterAll(async () => {
    const admin = adminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const user of data?.users ?? []) {
      if (user.email === before || user.email === after) {
        await admin.from('customers').delete().eq('user_id', user.id);
        await admin.auth.admin.deleteUser(user.id);
      }
    }
  });

  it('lets the customer sign in with the new email, the record following it (CA-11)', async () => {
    const admin = adminClient();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: before,
      password: SEED.password,
      email_confirm: true,
      user_metadata: { full_name: 'Sandbox Correo', data_consent: true },
    });
    if (error) throw new Error(`createUser failed: ${error.code}`);
    const userId = created.user.id;

    // What correctCustomerEmail does: Auth first, then the record.
    const changed = await admin.auth.admin.updateUserById(userId, {
      email: after,
      email_confirm: true,
    });
    expect(changed.error).toBeNull();
    const updated = await admin.from('customers').update({ email: after }).eq('user_id', userId);
    expect(updated.error).toBeNull();

    const { error: oldSignIn } = await publicClient().auth.signInWithPassword({
      email: before,
      password: SEED.password,
    });
    expect(oldSignIn?.code).toBe('invalid_credentials');
    const { client } = await signedInAs(after);
    const { data: me } = await client.from('customers').select('email').single();
    expect(me?.email).toBe(after);
  });
});
