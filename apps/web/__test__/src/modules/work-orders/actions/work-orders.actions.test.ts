// @vitest-environment node
/**
 * work-orders.actions — staff open, edit and close work orders (spec 008, HU-01, HU-02).
 *
 * Guards:
 * - RN-05: only ACTIVE STAFF; anyone else gets `forbidden` and nothing reaches the database. The
 *   functions run the rules again in Postgres, whoever calls them.
 * - CA-07 / CA-08: the order is sent to save_work_order as the function expects (lines with their
 *   employees; an existing line keeps its id) and the new order's id comes back, to open it.
 * - CA-10 / CA-12: the database refusals become their own messages (disabled customer, vehicle
 *   with another open order, shares, payments that do not add up…).
 * - CA-11: closing sends the payments to close_work_order.
 * - CA-21 / CA-23: staff void with a reason (the database decides who may void a closed order).
 * - CA-22 / RN-05: only an ACTIVE ADMIN corrects a closed order, always with a reason.
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  closeWorkOrder,
  correctWorkOrder,
  saveWorkOrder,
  voidWorkOrder,
} from '@web/modules/work-orders/actions/work-orders.actions';

import { buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({
  getActiveStaff: vi.fn(),
  getActiveAdmin: vi.fn(),
}));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const STAFF = buildProfile({ id: 'op-id', role: 'operator' });
const ORDER = '50000000-0000-4000-8000-000000000001';
const CUSTOMER = '10000000-0000-4000-8000-000000000001';
const VEHICLE = '20000000-0000-4000-8000-000000000001';
const SERVICE = '30000000-0000-4000-8000-000000000001';
const LINE = '60000000-0000-4000-8000-000000000001';
const ELENA = '40000000-0000-4000-8000-000000000001';

const form = (overrides: Record<string, unknown> = {}) => ({
  customer_id: CUSTOMER,
  vehicle_id: VEHICLE,
  lines: [
    {
      id: LINE,
      service_id: SERVICE,
      name: 'Lavado detallado',
      price: '60.000',
      estimated_minutes: '90',
      employees: [{ employee_id: ELENA, share_pct: '100' }],
    },
    {
      id: null,
      service_id: null,
      name: 'Limpieza de cadena',
      price: '15000',
      estimated_minutes: '',
      employees: [],
    },
  ],
  discount: '5.000',
  notes: '  Trae un rayón  ',
  ...overrides,
});

const fakeSession = (
  outcome: { data?: unknown; error?: { hint?: string; code?: string; message: string } | null } = {}
) => {
  const rpc = vi.fn().mockResolvedValue({ data: ORDER, error: null, ...outcome });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return rpc;
};

describe('work-orders.actions', () => {
  beforeEach(() => vi.mocked(getActiveStaff).mockResolvedValue(STAFF));
  afterEach(() => vi.clearAllMocks());

  it.each([
    ['saveWorkOrder', () => saveWorkOrder(form())],
    [
      'closeWorkOrder',
      () => closeWorkOrder({ id: ORDER, payments: [{ method: 'cash', amount: 70000 }] }),
    ],
  ])(
    '%s refuses anyone who is not active staff, before touching the database (RN-05)',
    async (_, run) => {
      vi.mocked(getActiveStaff).mockResolvedValue(null);

      await expect(run()).resolves.toEqual({ ok: false, error: 'forbidden' });
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    }
  );

  it('opens an order through save_work_order and returns its id (CA-07)', async () => {
    const rpc = fakeSession();

    await expect(saveWorkOrder(form())).resolves.toEqual({ ok: true, id: ORDER });

    expect(rpc).toHaveBeenCalledWith('save_work_order', {
      p_customer_id: CUSTOMER,
      p_vehicle_id: VEHICLE,
      p_lines: [
        // An existing line goes by its id: it keeps its service and name.
        {
          id: LINE,
          price: 60000,
          estimated_minutes: 90,
          employees: [{ employee_id: ELENA, share_pct: 100 }],
        },
        {
          name: 'Limpieza de cadena',
          price: 15000,
          estimated_minutes: null,
          employees: [],
        },
      ],
      p_discount: 5000,
      p_notes: 'Trae un rayón',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/orders', 'layout');
  });

  it('edits an open order by its id (CA-08)', async () => {
    const rpc = fakeSession();

    await saveWorkOrder({ id: ORDER, ...form() });

    expect(rpc).toHaveBeenCalledWith('save_work_order', expect.objectContaining({ p_id: ORDER }));
  });

  it('refuses invalid input before reaching the database (CA-09)', async () => {
    const rpc = fakeSession();

    const result = await saveWorkOrder(form({ lines: [] }));

    expect(result).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['work_order_customer_disabled', 'customerDisabled'],
    ['work_order_vehicle_retired', 'vehicleRetired'],
    ['work_order_vehicle_busy', 'vehicleBusy'],
    ['work_order_service_unavailable', 'serviceUnavailable'],
    ['work_order_shares_invalid', 'sharesInvalid'],
    ['work_order_not_open', 'notOpen'],
  ])('reports the database hint %s as «%s» (CA-10)', async (hint, error) => {
    fakeSession({ data: null, error: { hint, message: 'refused' } });

    await expect(saveWorkOrder(form())).resolves.toEqual({ ok: false, error });
  });

  it('closes an order with its payments (CA-11)', async () => {
    const rpc = fakeSession({ data: null });

    await expect(
      closeWorkOrder({
        id: ORDER,
        payments: [
          { method: 'cash', amount: '40.000' },
          { method: 'transfer', amount: 30000 },
        ],
      })
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith('close_work_order', {
      p_id: ORDER,
      p_payments: [
        { method: 'cash', amount: 40000 },
        { method: 'transfer', amount: 30000 },
      ],
    });
  });

  it.each([
    ['work_order_line_without_employees', 'lineWithoutEmployees'],
    ['work_order_payments_mismatch', 'paymentsMismatch'],
  ])('reports the closing refusal %s as «%s» (CA-12)', async (hint, error) => {
    fakeSession({ data: null, error: { hint, message: 'refused' } });

    await expect(closeWorkOrder({ id: ORDER, payments: [] })).resolves.toEqual({
      ok: false,
      error,
    });
  });
});

describe('work-orders.actions — voiding and correcting (HU-05)', () => {
  const ADMIN = buildProfile({ id: 'admin-id', role: 'admin' });

  beforeEach(() => {
    vi.mocked(getActiveStaff).mockResolvedValue(STAFF);
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
  });
  afterEach(() => vi.clearAllMocks());

  it('voids an order with its reason, trimmed (CA-21)', async () => {
    const rpc = fakeSession({ data: null });

    await expect(
      voidWorkOrder({ id: ORDER, reason: '  Se fue sin el servicio ' })
    ).resolves.toEqual({
      ok: true,
    });

    expect(rpc).toHaveBeenCalledWith('void_work_order', {
      p_id: ORDER,
      p_reason: 'Se fue sin el servicio',
    });
  });

  it('refuses to void without a reason, before the database (CA-21)', async () => {
    const rpc = fakeSession();

    await expect(voidWorkOrder({ id: ORDER, reason: '  ' })).resolves.toEqual({
      ok: false,
      error: 'reasonRequired',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports that only an admin voids a closed order (CA-23)', async () => {
    fakeSession({ data: null, error: { hint: 'work_order_admin_only', message: 'refused' } });

    await expect(voidWorkOrder({ id: ORDER, reason: 'Error' })).resolves.toEqual({
      ok: false,
      error: 'adminOnly',
    });
  });

  it('refuses a correction from anyone who is not an active admin (CA-22, RN-05)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    await expect(
      correctWorkOrder({ id: ORDER, ...form(), payments: [], reason: 'Error' })
    ).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('corrects a closed order: lines, discount, payments and the reason (CA-22)', async () => {
    const rpc = fakeSession({ data: null });

    await expect(
      correctWorkOrder({
        id: ORDER,
        ...form(),
        payments: [{ method: 'card', amount: '70.000' }],
        reason: ' Se cobró de más ',
      })
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith(
      'correct_work_order',
      expect.objectContaining({
        p_id: ORDER,
        p_discount: 5000,
        p_payments: [{ method: 'card', amount: 70000 }],
        p_reason: 'Se cobró de más',
      })
    );
  });

  it('refuses a correction without a reason (CA-22)', async () => {
    const rpc = fakeSession();

    const result = await correctWorkOrder({ id: ORDER, ...form(), payments: [], reason: '' });

    expect(result).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(rpc).not.toHaveBeenCalled();
  });
});
