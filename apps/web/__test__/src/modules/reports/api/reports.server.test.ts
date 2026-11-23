/**
 * reports.server — how the services report (spec 015) asks the database for its rows and totals,
 * with the admin's own session (the functions refuse anyone else, RN-04).
 *
 * Guards:
 * - CA-03 / CA-04 / CA-05: every filter reaches both functions, rows and totals alike (RF-02): the
 *   period, the employee and the plate; with none, the function's «any» (no argument).
 * - CA-11: the screen asks for a page of 50, skipping the previous pages: page 3 starts at row 100.
 * - CA-12: the Excel asks for every row: no limit, no skip.
 * - CA-03: the employees to filter by are all of them, also the disabled ones (no filter on them).
 * - A failed read is an error, never an empty report that would look like «no services».
 */
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { getServiceReport, listReportEmployees } from '@web/modules/reports/api/reports.server';
import type { ReportFilters } from '@web/modules/reports/types/reports.types';

vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));

const ELKIN = '6f1d2c3b-4a59-4e8f-9b0a-1c2d3e4f5a6b';
const TOTALS = { services: 120, subtotal: 3_000_000, discounts: 5000, total: 2_995_000 };

const rpc = vi.fn();
const order = vi.fn();
const select = vi.fn(() => ({ order }));
const from = vi.fn(() => ({ select }));

const filters = (overrides: Partial<ReportFilters> = {}): ReportFilters => ({
  from: '2026-11-01',
  to: '2026-11-23',
  employee: null,
  plate: '',
  page: 1,
  ...overrides,
});

/** The arguments each function was called with. */
const callTo = (name: string) => rpc.mock.calls.find(([fn]) => fn === name)?.[1];

describe('getServiceReport', () => {
  beforeEach(() => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc, from } as never);
    rpc.mockImplementation((name: string) =>
      Promise.resolve(
        name === 'service_report' ? { data: [], error: null } : { data: [TOTALS], error: null }
      )
    );
  });
  afterEach(() => vi.clearAllMocks());

  it('asks for page 3 as 50 rows after the first 100 (CA-11)', async () => {
    await getServiceReport(filters({ page: 3 }));

    // (3 − 1) × 50 = 100 rows skipped.
    expect(callTo('service_report')).toEqual({
      p_from: '2026-11-01',
      p_to: '2026-11-23',
      p_limit: 50,
      p_offset: 100,
    });
  });

  it('starts page 1 at the first row (CA-11)', async () => {
    await getServiceReport(filters());

    expect(callTo('service_report')).toMatchObject({ p_limit: 50, p_offset: 0 });
  });

  it('gives the employee and the plate to the rows and to the totals alike (CA-03, CA-04, RF-02)', async () => {
    await getServiceReport(filters({ employee: ELKIN, plate: 'UIH03D' }));

    const asked = {
      p_from: '2026-11-01',
      p_to: '2026-11-23',
      p_employee: ELKIN,
      p_plate: 'UIH03D',
    };
    expect(callTo('service_report')).toMatchObject(asked);
    expect(callTo('service_report_totals')).toEqual(asked);
  });

  it('without employee or plate, leaves them out: the function then takes any (CA-01)', async () => {
    await getServiceReport(filters());

    expect(callTo('service_report_totals')).toEqual({ p_from: '2026-11-01', p_to: '2026-11-23' });
  });

  it('asks for every row for the Excel: no limit and no skip (CA-12)', async () => {
    await getServiceReport(filters({ page: 4 }), { all: true });

    expect(callTo('service_report')).toEqual({ p_from: '2026-11-01', p_to: '2026-11-23' });
  });

  it('returns the rows and the totals of the whole filter (CA-11)', async () => {
    const result = await getServiceReport(filters());

    expect(result).toEqual({ rows: [], totals: TOTALS });
  });

  it('fails instead of showing an empty report when the database refuses (RN-04)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'only an admin sees the reports' } });

    await expect(getServiceReport(filters())).rejects.toThrow('only an admin sees the reports');
  });
});

describe('listReportEmployees', () => {
  beforeEach(() => vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc, from } as never));
  afterEach(() => vi.clearAllMocks());

  it('lists every employee by name, with no filter on the disabled ones (CA-03)', async () => {
    order.mockResolvedValue({
      data: [{ id: 'e1', full_name: 'Diego Desactivado', disabled_at: '2026-10-01T00:00:00Z' }],
      error: null,
    });

    const employees = await listReportEmployees();

    expect(from).toHaveBeenCalledWith('employees');
    expect(select).toHaveBeenCalledWith('id, full_name, disabled_at');
    expect(order).toHaveBeenCalledWith('full_name');
    expect(employees).toHaveLength(1);
  });
});
