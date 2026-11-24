// @vitest-environment node
/**
 * data-rights.actions — a customer's data requests, and the admin attending them (spec 017).
 *
 * Guards:
 * - RN-01: a customer's actions need an enabled customer; the admin's, an active admin. Anyone
 *   else gets `forbidden` and nothing reaches the database (whose functions check again).
 * - CA-04 / CA-05 / CA-08: the customer asks for a correction (what to correct) or an erasure
 *   (optional reason) and withdraws their own, through the database functions.
 * - CA-11 / CA-14 / CA-12 / CA-16: the admin attends, rejects, erases and registers.
 * - CA-11 / RN-08: changing a customer's email changes the email they sign in with (Auth's admin
 *   API), then the record; a Google account's email is Google's, never changed here.
 * - The database's refusals become their own message.
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin, getActiveCustomer } from '@web/modules/auth/api/auth.server';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  correctCustomerEmail,
  eraseCustomerData,
  registerDataRequest,
  rejectDataRequest,
  requestCorrection,
  requestErasure,
  resolveDataRequest,
  withdrawDataRequest,
} from '@web/modules/data-rights/actions/data-rights.actions';

import { buildCustomer, buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({
  getActiveAdmin: vi.fn(),
  getActiveCustomer: vi.fn(),
}));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('@web/modules/core/lib/supabase-admin.lib', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const ADMIN = buildProfile({ id: 'admin-id', role: 'admin' });
const CUSTOMER = buildCustomer();
const REQUEST = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';
const CUSTOMER_ID = '7a2d1e3f-9b5c-4d4e-8f60-1b2c3d4e5f60';

type DbError = { code?: string; hint?: string; message: string } | null;

const fakeSession = (error: DbError = null) => {
  const rpc = vi.fn().mockResolvedValue({ data: REQUEST, error });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return { rpc };
};

/** The secret-key client: reads the customer, changes the Auth user, then the record. */
const fakeAdminClient = ({
  customer = { user_id: 'user-1', origin: 'self_signup' },
  authError = null,
}: {
  customer?: { user_id: string | null; origin: string };
  authError?: { code: string } | null;
} = {}) => {
  const updateUserById = vi.fn().mockResolvedValue({ error: authError });
  const updated = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updated }));
  const single = vi.fn().mockResolvedValue({ data: customer, error: null });
  const select = vi.fn(() => ({ eq: () => ({ single }) }));
  const from = vi.fn(() => ({ select, update }));
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from,
    auth: { admin: { updateUserById } },
  } as never);
  return { updateUserById, update, updated };
};

describe('data-rights.actions — the customer', () => {
  beforeEach(() => vi.mocked(getActiveCustomer).mockResolvedValue(CUSTOMER));
  afterEach(() => vi.clearAllMocks());

  it.each([
    ['requestCorrection', () => requestCorrection({ description: 'x' })],
    ['requestErasure', () => requestErasure({ reason: '' })],
    ['withdrawDataRequest', () => withdrawDataRequest({ id: REQUEST })],
  ])('%s needs an enabled customer, before touching the database (RN-01)', async (_, run) => {
    vi.mocked(getActiveCustomer).mockResolvedValue(null);

    await expect(run()).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('asks for a correction with what to correct, and renders «Mis datos» again (CA-04)', async () => {
    const { rpc } = fakeSession();

    await expect(requestCorrection({ description: ' Mi correo es otro ' })).resolves.toEqual({
      ok: true,
    });

    expect(rpc).toHaveBeenCalledWith('request_data_change', {
      p_kind: 'correction',
      p_description: 'Mi correo es otro',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/my/data');
  });

  it('refuses a correction without what to correct, before the database (CA-04)', async () => {
    fakeSession();

    await expect(requestCorrection({ description: ' ' })).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('asks for an erasure, the reason optional (CA-05)', async () => {
    const { rpc } = fakeSession();

    await requestErasure({ reason: '' });
    await requestErasure({ reason: 'Ya no uso el servicio' });

    expect(rpc).toHaveBeenNthCalledWith(1, 'request_data_change', { p_kind: 'erasure' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'request_data_change', {
      p_kind: 'erasure',
      p_description: 'Ya no uso el servicio',
    });
  });

  it('says one of that kind is already open (CA-06)', async () => {
    fakeSession({ hint: 'data_request_open', message: 'open' });

    await expect(requestErasure({})).resolves.toEqual({ ok: false, error: 'alreadyOpen' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('withdraws their own request (CA-08)', async () => {
    const { rpc } = fakeSession();

    await expect(withdrawDataRequest({ id: REQUEST })).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('withdraw_data_request', { p_id: REQUEST });
  });
});

describe('data-rights.actions — the admin', () => {
  beforeEach(() => vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN));
  afterEach(() => vi.clearAllMocks());

  it.each([
    [
      'registerDataRequest',
      () =>
        registerDataRequest({
          customerId: CUSTOMER_ID,
          kind: 'inquiry',
          channel: 'counter',
          description: 'x',
        }),
    ],
    ['resolveDataRequest', () => resolveDataRequest({ id: REQUEST, response: 'x' })],
    ['rejectDataRequest', () => rejectDataRequest({ id: REQUEST, response: 'x' })],
    ['eraseCustomerData', () => eraseCustomerData({ id: REQUEST })],
    [
      'correctCustomerEmail',
      () => correctCustomerEmail({ customerId: CUSTOMER_ID, email: 'a@b.co' }),
    ],
  ])('%s needs an active admin, before touching the database (CA-15)', async (_, run) => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    await expect(run()).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('registers a request from the counter (CA-16)', async () => {
    const { rpc } = fakeSession();

    await expect(
      registerDataRequest({
        customerId: CUSTOMER_ID,
        kind: 'inquiry',
        channel: 'counter',
        description: ' Sus datos ',
      })
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith('register_data_request', {
      p_customer: CUSTOMER_ID,
      p_kind: 'inquiry',
      p_channel: 'counter',
      p_description: 'Sus datos',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/data-requests', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith(`/customers/${CUSTOMER_ID}`);
  });

  it('attends and rejects with an answer (CA-11, CA-14)', async () => {
    const { rpc } = fakeSession();

    await resolveDataRequest({ id: REQUEST, response: 'Listo' });
    await rejectDataRequest({ id: REQUEST, response: 'Hay un deber legal' });

    expect(rpc).toHaveBeenNthCalledWith(1, 'resolve_data_request', {
      p_id: REQUEST,
      p_response: 'Listo',
    });
    expect(rpc).toHaveBeenNthCalledWith(2, 'reject_data_request', {
      p_id: REQUEST,
      p_reason: 'Hay un deber legal',
    });
  });

  it('erases, and says when an open order stops it (CA-12, CA-13)', async () => {
    const { rpc } = fakeSession();
    await expect(eraseCustomerData({ id: REQUEST })).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('erase_customer_data', { p_request_id: REQUEST });

    fakeSession({ hint: 'data_erasure_open_order', message: 'open order #4' });
    await expect(eraseCustomerData({ id: REQUEST })).resolves.toEqual({
      ok: false,
      error: 'openOrder',
    });
  });

  it('changes the email a customer signs in with, then their record (CA-11)', async () => {
    const { updateUserById, update, updated } = fakeAdminClient();

    await expect(
      correctCustomerEmail({ customerId: CUSTOMER_ID, email: ' Camila.Nueva@Correo.Test ' })
    ).resolves.toEqual({ ok: true });

    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      email: 'camila.nueva@correo.test',
      email_confirm: true,
    });
    expect(update).toHaveBeenCalledWith({ email: 'camila.nueva@correo.test' });
    expect(updated).toHaveBeenCalledWith('id', CUSTOMER_ID);
  });

  it('changes only the record of a customer without account (CA-11)', async () => {
    const { updateUserById, update } = fakeAdminClient({
      customer: { user_id: null, origin: 'counter' },
    });

    await expect(
      correctCustomerEmail({ customerId: CUSTOMER_ID, email: 'v@correo.test' })
    ).resolves.toEqual({
      ok: true,
    });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ email: 'v@correo.test' });
  });

  it('never changes the email of a Google account: Google sets it (RN-08)', async () => {
    const { updateUserById, update } = fakeAdminClient({
      customer: { user_id: 'user-1', origin: 'google' },
    });

    await expect(
      correctCustomerEmail({ customerId: CUSTOMER_ID, email: 'a@b.co' })
    ).resolves.toEqual({
      ok: false,
      error: 'googleEmail',
    });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('says when another account already uses that email (CA-11)', async () => {
    const { update } = fakeAdminClient({ authError: { code: 'email_exists' } });

    await expect(
      correctCustomerEmail({ customerId: CUSTOMER_ID, email: 'a@b.co' })
    ).resolves.toEqual({
      ok: false,
      error: 'emailTaken',
    });
    expect(update).not.toHaveBeenCalled();
  });
});
