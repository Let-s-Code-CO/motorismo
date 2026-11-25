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
 * - Spec 022: registering goes through register_customer, with the first vehicle when it comes, so
 *   both are registered together or not at all (RN-01); a refusal of the vehicle comes back as the
 *   vehicle's own error (CA-07), told apart from the customer's.
 * - CA-29 / CA-30 / CA-31 / RN-09: ACTIVE STAFF (operator or admin) disable or reactivate; for a customer with
 *   an account, Auth also bans (or lifts the ban on) the account — no new session can be issued —
 *   and if Auth fails the change is reverted. A customer without account has nothing to ban.
 */
import { revalidatePath } from 'next/cache';

import { getActiveStaff } from '@web/modules/auth/api/auth.server';
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
const ID = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

type Outcome = { data?: unknown; error?: { code?: string; hint?: string; message: string } | null };

/** The staff member's own session: customers insert/select/update. */
const fakeSession = ({
  insert = { data: { id: 'customer-new' }, error: null },
  register = { data: 'customer-new', error: null },
  current = { user_id: null, disabled_at: null },
  updates = [{ data: { id: ID }, error: null }],
}: {
  insert?: Outcome;
  register?: Outcome;
  current?: Record<string, unknown> | null;
  updates?: Outcome[];
} = {}) => {
  const insertFn = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: null, error: null, ...insert }) }),
  }));
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
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: null, ...register }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from, rpc } as never);
  return { from, insert: insertFn, update, rpc };
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
    const { rpc } = fakeSession();

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
    expect(rpc).not.toHaveBeenCalled();
  });

  it('registers only the contact data with the staff session, refreshes the list and returns the new id (CA-24; spec 012, CA-02; spec 022, CA-06)', async () => {
    const { rpc } = fakeSession();

    // The id lets a reservation or an order choose the customer just registered.
    await expect(createCustomer(input)).resolves.toEqual({ ok: true, id: 'customer-new' });
    // Origin, registrar and consent date are set by the database (customers_guard); no vehicle.
    expect(rpc).toHaveBeenCalledWith('register_customer', {
      p_full_name: 'Marta',
      p_email: null,
      p_phone: '3120001111',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/customers', 'layout');
  });

  it('registers the first vehicle in the same call, normalised (spec 022, CA-07, RN-01)', async () => {
    const { rpc } = fakeSession();

    await createCustomer({
      ...input,
      vehicle: {
        vehicle_type: 'motorcycle',
        vehicle_class: null,
        brand_name: 'Suzuki',
        line_name: 'GSX-R600',
        displacement_cc: 600,
        color: 'black',
        plate: 'uih-03d',
        plate_city_code: null,
      },
    });

    expect(rpc).toHaveBeenCalledWith('register_customer', {
      p_full_name: 'Marta',
      p_email: null,
      p_phone: '3120001111',
      p_vehicle_type: 'motorcycle',
      p_brand_name: 'Suzuki',
      p_line_name: 'GSX-R600',
      p_displacement_cc: 600,
      p_color: 'black',
      p_plate: 'UIH03D',
    });
  });

  it('maps the duplicate-email refusal of the database (CA-26)', async () => {
    fakeSession({
      register: { error: { code: '23505', hint: 'customer_email_taken', message: 'x' } },
    });

    await expect(createCustomer(input)).resolves.toEqual({ ok: false, error: 'emailTaken' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['vehicle_plate_taken', '23505', 'plateTaken'],
    ['vehicle_class_required', 'P0001', 'classRequired'],
  ])(
    'tells a refusal of the vehicle (%s) apart, with its own message (spec 022, CA-07)',
    async (hint, code, vehicleError) => {
      fakeSession({ register: { error: { code, hint, message: 'x' } } });

      await expect(
        createCustomer({
          ...input,
          vehicle: {
            vehicle_type: 'motorcycle',
            brand_name: 'Suzuki',
            line_name: 'GSX-R600',
            color: 'black',
            plate: 'UIH03D',
          },
        })
      ).resolves.toEqual({ ok: false, error: 'vehicle', vehicleError });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );
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
  // RN-09: any active staff member — an operator here — disables and reactivates.
  beforeEach(() => vi.mocked(getActiveStaff).mockResolvedValue(STAFF));
  afterEach(() => vi.clearAllMocks());

  it('rejects anyone who is not active staff, e.g. a customer (CA-31, RN-09)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);

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
