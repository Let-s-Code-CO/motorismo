// @vitest-environment node
/**
 * customers.actions — staff register, edit and disable customers (spec 004, HU-06 / HU-07).
 *
 * Guards:
 * - CA-24 / RF-04: only ACTIVE STAFF register or edit; the row is written with their OWN session,
 *   so RLS and the database guard decide (origin, registrar and consent date are set there).
 * - CA-25: invalid input returns one error per field and nothing is written.
 * - CA-26: the guard's "email already in use" becomes its own message.
 * - CA-27 / RN-10: the email of a customer WITH account is never sent in an edit.
 * - CA-29 / CA-30 / CA-31 / RN-09: only an ACTIVE ADMIN disables or reactivates; for a customer with
 *   an account, Auth also bans (or lifts the ban on) the account — no new session can be issued —
 *   and if Auth fails the change is reverted. A customer without account has nothing to ban.
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  createCustomer,
  setCustomerDisabled,
  updateCustomer,
} from '@web/modules/customers/actions/customers.actions';

import { buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({
  getActiveStaff: vi.fn(),
  getActiveAdmin: vi.fn(),
  getActiveCustomer: vi.fn(),
}));
vi.mock('@web/modules/core/lib/supabase-admin.lib', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const STAFF = buildProfile({ id: 'op-id', role: 'operator' });
const ADMIN = buildProfile({ id: 'admin-id', role: 'admin' });
const ID = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

type Outcome = { data?: unknown; error?: { code?: string; hint?: string; message: string } | null };

/** The staff member's own session: customers insert/select/update. */
const fakeSession = ({
  insert = { error: null },
  current = { user_id: null, disabled_at: null },
  updates = [{ data: { id: ID }, error: null }],
}: { insert?: Outcome; current?: Record<string, unknown> | null; updates?: Outcome[] } = {}) => {
  const insertFn = vi.fn().mockResolvedValue({ error: null, ...insert });
  const update = vi.fn();
  updates.forEach((outcome) =>
    update.mockReturnValueOnce({
      eq: () => ({
        select: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null, ...outcome }),
        }),
      }),
    })
  );
  const select = vi.fn(() => ({
    eq: () => ({ maybeSingle: () => Promise.resolve({ data: current, error: null }) }),
  }));
  const from = vi.fn(() => ({ insert: insertFn, update, select }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from } as never);
  return { from, insert: insertFn, update };
};

const fakeAuthAdmin = (banError: { message: string } | null = null) => {
  const updateUserById = vi.fn().mockResolvedValue({ error: banError });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    auth: { admin: { updateUserById } },
  } as never);
  return { updateUserById };
};

describe('createCustomer', () => {
  beforeEach(() => vi.mocked(getActiveStaff).mockResolvedValue(STAFF));
  afterEach(() => vi.clearAllMocks());

  const input = { full_name: ' Marta ', email: '', phone: '312 000 1111', data_consent: true };

  it('rejects anyone who is not active staff (RF-04)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);

    await expect(createCustomer(input)).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('returns one error per invalid field and writes nothing (CA-25)', async () => {
    const { insert } = fakeSession();

    await expect(
      createCustomer({ full_name: '', email: '', phone: '', data_consent: false })
    ).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
      fieldErrors: {
        full_name: ['fullNameRequired'],
        email: ['contactRequired'],
        data_consent: ['consentRequired'],
      },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts only the contact data with the staff session and refreshes the list (CA-24)', async () => {
    const { from, insert } = fakeSession();

    await expect(createCustomer(input)).resolves.toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith('customers');
    // Origin, registrar and consent date are set by the database (customers_guard).
    expect(insert).toHaveBeenCalledWith({ full_name: 'Marta', email: null, phone: '3120001111' });
    expect(revalidatePath).toHaveBeenCalledWith('/customers', 'layout');
  });

  it('maps the duplicate-email refusal of the database (CA-26)', async () => {
    fakeSession({
      insert: { error: { code: '23505', hint: 'customer_email_taken', message: 'x' } },
    });

    await expect(createCustomer(input)).resolves.toEqual({ ok: false, error: 'emailTaken' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('updateCustomer', () => {
  beforeEach(() => vi.mocked(getActiveStaff).mockResolvedValue(STAFF));
  afterEach(() => vi.clearAllMocks());

  const input = { id: ID, full_name: 'Marta M.', email: 'marta@correo.test', phone: '' };

  it('rejects anyone who is not active staff', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);

    await expect(updateCustomer(input)).resolves.toEqual({ ok: false, error: 'forbidden' });
  });

  it('updates name, email and phone of a customer without account (CA-27)', async () => {
    const { update } = fakeSession({ current: { user_id: null } });

    await expect(updateCustomer(input)).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      full_name: 'Marta M.',
      email: 'marta@correo.test',
      phone: null,
    });
  });

  it('never sends the email of a customer with an account (CA-27, RN-10)', async () => {
    const { update } = fakeSession({ current: { user_id: 'u-1' } });

    await expect(updateCustomer(input)).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ full_name: 'Marta M.', phone: null });
  });

  it('reports a customer that does not exist (or cannot be seen)', async () => {
    fakeSession({ current: null });

    await expect(updateCustomer(input)).resolves.toEqual({ ok: false, error: 'notFound' });
  });
});

describe('setCustomerDisabled', () => {
  beforeEach(() => vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN));
  afterEach(() => vi.clearAllMocks());

  it('rejects anyone who is not an active admin (CA-31, RN-09)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    await expect(setCustomerDisabled({ id: ID, disabled: true })).resolves.toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('disables a customer with account and bans the account in Auth (CA-29)', async () => {
    const { update } = fakeSession({ current: { user_id: 'u-1', disabled_at: null } });
    const { updateUserById } = fakeAuthAdmin();

    await expect(setCustomerDisabled({ id: ID, disabled: true })).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ disabled_at: expect.any(String) });
    expect(updateUserById).toHaveBeenCalledWith('u-1', { ban_duration: '876000h' });
  });

  it('reactivates and lifts the ban (CA-30)', async () => {
    fakeSession({ current: { user_id: 'u-1', disabled_at: '2026-11-19T10:00:00Z' } });
    const { updateUserById } = fakeAuthAdmin();

    await expect(setCustomerDisabled({ id: ID, disabled: false })).resolves.toEqual({ ok: true });
    expect(updateUserById).toHaveBeenCalledWith('u-1', { ban_duration: 'none' });
  });

  it('has nothing to ban for a customer without account', async () => {
    fakeSession({ current: { user_id: null, disabled_at: null } });
    const { updateUserById } = fakeAuthAdmin();

    await expect(setCustomerDisabled({ id: ID, disabled: true })).resolves.toEqual({ ok: true });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('reverts the change when Auth fails, so both stay consistent', async () => {
    const { update } = fakeSession({
      current: { user_id: 'u-1', disabled_at: null },
      updates: [
        { data: { id: ID }, error: null },
        { data: { id: ID }, error: null },
      ],
    });
    fakeAuthAdmin({ message: 'auth down' });

    await expect(setCustomerDisabled({ id: ID, disabled: true })).resolves.toEqual({
      ok: false,
      error: 'generic',
    });
    expect(update).toHaveBeenLastCalledWith({ disabled_at: null });
  });
});
