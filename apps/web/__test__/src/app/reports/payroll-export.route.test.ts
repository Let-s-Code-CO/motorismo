// @vitest-environment node
/**
 * GET /reports/payroll/export — the Excel of a month's payroll (spec 016, HU-04).
 *
 * Guards:
 * - CA-20 / RN-08: only an active admin gets the file, checked on the server; anyone else gets 403
 *   and the payroll is never read for them.
 * - CA-18: the file has the summary and the detail of every employee of the month of the address
 *   (the month in progress when it says none), named by its month, and says when it is provisional.
 * The cells are payroll-workbook.lib's (its own test); here, that a real .xlsx comes out (a zip:
 * «PK»).
 */
import { NextRequest } from 'next/server';

import { GET } from '@web/app/(app)/reports/payroll/export/route';
import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import {
  getPayrollItems,
  getPayrollLines,
  getPayrollMonth,
} from '@web/modules/reports/api/payroll.server';
import type { PayrollLine, PayrollMonth } from '@web/modules/reports/types/reports.types';

vi.mock('@web/modules/auth/api/auth.server', () => ({ getActiveAdmin: vi.fn() }));
vi.mock('@web/modules/reports/api/payroll.server', () => ({
  getPayrollMonth: vi.fn(),
  getPayrollLines: vi.fn(),
  getPayrollItems: vi.fn(),
}));

const ADMIN = { kind: 'staff', id: 'a1', role: 'admin', status: 'active' } as never;

const STATE: PayrollMonth = {
  month: '2026-10-01',
  status: 'closed',
  total: 698000,
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
    active_days: 15,
    month_days: 31,
    base_salary: 1300000,
    base_pay: 629032,
    commission_pct: 40,
    commissions: 48000,
    total: 677032,
  },
  {
    employee_id: 'e-elkin',
    employee_name: 'Elkin Estrada',
    active_days: 31,
    month_days: 31,
    base_salary: 1500000,
    base_pay: 1500000,
    commission_pct: 30,
    commissions: 0,
    total: 1500000,
  },
];

const request = (query: string) =>
  new NextRequest(`http://localhost:3000/reports/payroll/export${query}`);

describe('GET /reports/payroll/export', () => {
  beforeEach(() => {
    vi.mocked(getPayrollMonth).mockResolvedValue(STATE);
    vi.mocked(getPayrollLines).mockResolvedValue(LINES);
    vi.mocked(getPayrollItems).mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('answers 403 to anyone who is not an active admin, without reading the payroll (CA-20)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    const response = await GET(request('?month=2026-10'));

    expect(response.status).toBe(403);
    expect(getPayrollMonth).not.toHaveBeenCalled();
    expect(getPayrollLines).not.toHaveBeenCalled();
  });

  it('reads the month of the address and the detail of each of its employees (CA-18)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);

    await GET(request('?month=2026-10'));

    expect(getPayrollMonth).toHaveBeenCalledWith('2026-10');
    expect(getPayrollLines).toHaveBeenCalledWith('2026-10');
    expect(getPayrollItems).toHaveBeenCalledWith('2026-10', 'e-paula');
    expect(getPayrollItems).toHaveBeenCalledWith('2026-10', 'e-elkin');
  });

  it('gives the admin an Excel file named by its month (CA-18)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);

    const response = await GET(request('?month=2026-10'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="liquidacion-2026-10.xlsx"'
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
  });

  it('says in the name when the month is still provisional (CA-18)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
    vi.mocked(getPayrollMonth).mockResolvedValue({ ...STATE, status: 'provisional' });

    const response = await GET(request('?month=2026-10'));

    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="liquidacion-2026-10-provisional.xlsx"'
    );
  });
});
