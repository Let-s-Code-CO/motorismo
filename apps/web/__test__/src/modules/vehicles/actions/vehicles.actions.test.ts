// @vitest-environment node
/**
 * vehicles.actions — saving and retiring vehicles (spec 005).
 *
 * The database decides (RLS, vehicles_guard, save_vehicle); these actions only make sure that:
 * - only an ACTIVE staff member or an ENABLED customer gets through (RN-01);
 * - a customer always writes on THEIR OWN record, whatever customer id the request carries
 *   (CA-26): the id comes from their session, not from the browser;
 * - invalid input returns one error per field and calls nothing (CA-07);
 * - the vehicle goes to save_vehicle with the brand and line BY NAME (CA-13, CA-14), and the
 *   database refusals become messages for the right audience (CA-08 staff, CA-25 customer);
 * - retiring (CA-21, CA-24) is an update of the retirement date with the user's own session: a
 *   vehicle they may not change is "not found" (RLS hides it), a retired one says so (CA-22).
 */
import { revalidatePath } from 'next/cache';

import { getActiveCustomer, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { retireVehicle, saveVehicle } from '@web/modules/vehicles/actions/vehicles.actions';

import { buildCustomer, buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({
  getActiveStaff: vi.fn(),
  getActiveCustomer: vi.fn(),
}));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const STAFF = buildProfile({ role: 'operator' });
const OWN = buildCustomer({ id: '11111111-2222-4333-8444-555555555555' });
const OTHER_CUSTOMER_ID = '99999999-8888-4777-8666-555555555555';

const motorcycle = (overrides: Record<string, unknown> = {}) => ({
  customer_id: OTHER_CUSTOMER_ID,
  vehicle_type: 'motorcycle',
  vehicle_class: null,
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  displacement_cc: 600,
  color: 'black',
  plate: 'uih-03d',
  ...overrides,
});

const fakeSession = (outcome: { data?: unknown; error?: unknown } = {}) => {
  const rpc = vi.fn().mockResolvedValue({ data: 'vehicle-id', error: null, ...outcome });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return { rpc };
};

describe('saveVehicle', () => {
  afterEach(() => vi.clearAllMocks());

  it('refuses without an active staff member or an enabled customer', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);
    vi.mocked(getActiveCustomer).mockResolvedValue(null);
    const { rpc } = fakeSession();

    expect(await saveVehicle(motorcycle())).toEqual({ ok: false, error: 'forbidden' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends a staff member's vehicle for the customer of the request, brand and line by name", async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    const { rpc } = fakeSession();

    expect(await saveVehicle(motorcycle())).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith('save_vehicle', {
      p_customer_id: OTHER_CUSTOMER_ID,
      p_vehicle_type: 'motorcycle',
      p_brand_name: 'Suzuki',
      p_line_name: 'GSX-R600',
      p_displacement_cc: 600,
      p_color: 'black',
      p_plate: 'UIH03D',
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/customers/${OTHER_CUSTOMER_ID}`);
  });

  it("always saves a customer's vehicle on their OWN record, whatever id the request carries (CA-26)", async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);
    vi.mocked(getActiveCustomer).mockResolvedValue(OWN as never);
    const { rpc } = fakeSession();

    await saveVehicle(motorcycle({ customer_id: OTHER_CUSTOMER_ID }));

    expect(rpc).toHaveBeenCalledWith(
      'save_vehicle',
      expect.objectContaining({ p_customer_id: OWN.id })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/profile');
  });

  it('sends the vehicle id when correcting a vehicle (CA-20)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    const { rpc } = fakeSession();
    const vehicleId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    await saveVehicle(motorcycle({ vehicle_id: vehicleId }));

    expect(rpc).toHaveBeenCalledWith(
      'save_vehicle',
      expect.objectContaining({ p_vehicle_id: vehicleId })
    );
  });

  it('returns the field errors of invalid input and calls nothing (CA-07)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    const { rpc } = fakeSession();

    const result = await saveVehicle(motorcycle({ brand_name: '', plate: 'ABC123' }));

    expect(result).toEqual({
      ok: false,
      error: 'invalidInput',
      fieldErrors: { brand_name: ['brandRequired'], plate: ['plateInvalid'] },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('turns a taken plate into the staff message (CA-08)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    fakeSession({ data: null, error: { hint: 'vehicle_plate_taken', message: 'taken' } });

    expect(await saveVehicle(motorcycle())).toEqual({ ok: false, error: 'plateTaken' });
  });

  it('turns a taken plate into the customer message (CA-25)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);
    vi.mocked(getActiveCustomer).mockResolvedValue(OWN as never);
    fakeSession({ data: null, error: { hint: 'vehicle_plate_taken', message: 'taken' } });

    expect(await saveVehicle(motorcycle())).toEqual({ ok: false, error: 'plateTakenCustomer' });
  });
});

const VEHICLE_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

/** The user's own session: vehicles.update(...).eq(...).select(...).maybeSingle(). */
const fakeRetire = (outcome: { data?: unknown; error?: unknown }) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null, ...outcome });
  const eq = vi.fn(() => ({ select: () => ({ maybeSingle }) }));
  const update = vi.fn(() => ({ eq }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from: () => ({ update }) } as never);
  return { update, eq };
};

describe('retireVehicle', () => {
  afterEach(() => vi.clearAllMocks());

  it('refuses without an active staff member or an enabled customer', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);
    vi.mocked(getActiveCustomer).mockResolvedValue(null);
    const { update } = fakeRetire({});

    expect(await retireVehicle({ id: VEHICLE_ID })).toEqual({ ok: false, error: 'forbidden' });
    expect(update).not.toHaveBeenCalled();
  });

  it('answers "not found" for an id that is not a uuid, without touching anything', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    const { update } = fakeRetire({});

    expect(await retireVehicle({ id: 'nope' })).toEqual({ ok: false, error: 'notFound' });
    expect(update).not.toHaveBeenCalled();
  });

  it('sets the retirement date of the vehicle and refreshes its customer (CA-21)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    const { update, eq } = fakeRetire({ data: { customer_id: OTHER_CUSTOMER_ID } });

    expect(await retireVehicle({ id: VEHICLE_ID })).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ retired_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith('id', VEHICLE_ID);
    expect(revalidatePath).toHaveBeenCalledWith(`/customers/${OTHER_CUSTOMER_ID}`);
  });

  it('answers "not found" when the vehicle is not visible to the user (RLS, CA-26)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(null);
    vi.mocked(getActiveCustomer).mockResolvedValue(OWN as never);
    fakeRetire({ data: null });

    expect(await retireVehicle({ id: VEHICLE_ID })).toEqual({ ok: false, error: 'notFound' });
  });

  it('says so when the vehicle was already retired (CA-22)', async () => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    fakeRetire({ error: { hint: 'vehicle_retired', message: 'retired' } });

    expect(await retireVehicle({ id: VEHICLE_ID })).toEqual({ ok: false, error: 'retired' });
  });
});
