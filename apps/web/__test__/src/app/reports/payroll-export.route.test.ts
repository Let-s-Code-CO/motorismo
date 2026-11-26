// @vitest-environment node
/**
 * GET /reports/payroll/export — the Excel of a period's payroll (spec 020, CA-17; spec 016, HU-04).
 *
 * Guards:
 * - spec 016, RN-08: only an active admin gets the file, checked on the server; anyone else gets 403
 *   and the payroll is never read for them.
 * - CA-17: the file has the summary and the detail of every employee of the period and method of the
 *   address (the fortnight in progress when it says none, CA-09), named by its period, and says when
 *   a fortnight is provisional.
 * The cells are payroll-workbook.lib's (its own test); here, that a real .xlsx comes out (a zip:
 * «PK»).
 */
import { NextRequest } from 'next/server';

import { GET } from '@web/app/(app)/reports/payroll/export/route';
import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import {
  getPayrollItems,
  getPayrollLines,
  getPayrollPeriod,
} from '@web/modules/reports/api/payroll.server';
import type { PayrollLine, PayrollState } from '@web/modules/reports/types/reports.types';

vi.mock('@web/modules/auth/api/auth.server', () => ({ getActiveAdmin: vi.fn() }));
vi.mock('@web/modules/reports/api/payroll.server', () => ({
  getPayrollPeriod: vi.fn(),
  getPayrollLines: vi.fn(),
  getPayrollItems: vi.fn(),
}));

const ADMIN = { kind: 'staff', id: 'a1', role: 'admin', status: 'active' } as never;

const STATE: PayrollState = {
  kind: 'fortnight',
  status: 'closed',
  method: 'commercial',
  total: 1348000,
  closed_at: '2026-11-02T15:00:00Z',
  closed_by_name: 'Carlos Díaz',
  regenerated_at: null,
  regenerated_by_name: null,
  previous_total: null,
  changed_since_close: false,
  can_close: false,
};

const LINES: PayrollLine[] = [
  {
    employee_id: 'e-paula',
    employee_name: 'Paula Pineda',
    active_days: 16,
    period_days: 16,
    base_salary: 1300000,
    base_pay: 650000,
    commission_pct: 40,
    commissions: 48000,
    total: 698000,
  },
  {
    employee_id: 'e-elkin',
    employee_name: 'Elkin Estrada',
    active_days: 16,
    period_days: 16,
    base_salary: 1300000,
    base_pay: 650000,
    commission_pct: 30,
    commissions: 0,
    total: 650000,
  },
];

const OCTOBER_2 = { period: { kind: 'fortnight', start: '2026-10-16' }, method: 'actual' };

const request = (query: string) =>
  new NextRequest(`http://localhost:3000/reports/payroll/export${query}`);

describe('GET /reports/payroll/export', () => {
  beforeEach(() => {
    vi.mocked(getPayrollPeriod).mockResolvedValue(STATE);
    vi.mocked(getPayrollLines).mockResolvedValue(LINES);
    vi.mocked(getPayrollItems).mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('answers 403 to anyone who is not an active admin, without reading the payroll (RN-08)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    const response = await GET(request('?fortnight=2026-10-2'));

    expect(response.status).toBe(403);
    expect(getPayrollPeriod).not.toHaveBeenCalled();
    expect(getPayrollLines).not.toHaveBeenCalled();
  });

  it('reads the period and method of the address and the detail of each of its employees (CA-17)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);

    await GET(request('?fortnight=2026-10-2&base=actual'));

    expect(getPayrollPeriod).toHaveBeenCalledWith(OCTOBER_2);
    expect(getPayrollLines).toHaveBeenCalledWith(OCTOBER_2);
    expect(getPayrollItems).toHaveBeenCalledWith(OCTOBER_2, 'e-paula');
    expect(getPayrollItems).toHaveBeenCalledWith(OCTOBER_2, 'e-elkin');
  });

  it('gives the admin an Excel file named by its fortnight (CA-17)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);

    const response = await GET(request('?fortnight=2026-10-2'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="liquidacion-2026-10-2a-quincena.xlsx"'
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
  });

  it('says in the name when the fortnight is still provisional (CA-17)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
    vi.mocked(getPayrollPeriod).mockResolvedValue({ ...STATE, status: 'provisional' });

    const response = await GET(request('?fortnight=2026-10-2'));

    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="liquidacion-2026-10-2a-quincena-provisional.xlsx"'
    );
  });

  it('names a range by its two days (CA-17)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
    vi.mocked(getPayrollPeriod).mockResolvedValue({ ...STATE, kind: 'range', status: 'query' });

    const response = await GET(request('?from=2026-10-03&to=2026-10-20'));

    expect(getPayrollLines).toHaveBeenCalledWith({
      period: { kind: 'range', from: '2026-10-03', to: '2026-10-20' },
      method: null,
    });
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="liquidacion-2026-10-03-a-2026-10-20.xlsx"'
    );
  });
});
