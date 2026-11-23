// @vitest-environment node
/**
 * GET /reports/services/export — the Excel download of the services report (spec 015, HU-02).
 *
 * Guards:
 * - CA-14, RN-04: only an active admin gets the file, checked on the server; anyone else (an
 *   operator, a customer, nobody) gets 403 and the report is never read for them, even asking for
 *   the address directly.
 * - CA-12, RF-02: the file holds every row of the same filters as the screen (read from the
 *   address with the same schema, not only a page), and is named by its period.
 * The cells themselves are services-workbook.lib's (its own test); here, that a real .xlsx comes
 * out (a zip: it starts with «PK»).
 */
import { NextRequest } from 'next/server';

import { GET } from '@web/app/(app)/reports/services/export/route';
import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { getServiceReport } from '@web/modules/reports/api/reports.server';
import type { ServiceReportRow } from '@web/modules/reports/types/reports.types';

vi.mock('@web/modules/auth/api/auth.server', () => ({ getActiveAdmin: vi.fn() }));
vi.mock('@web/modules/reports/api/reports.server', () => ({ getServiceReport: vi.fn() }));

const ADMIN = { kind: 'staff', id: 'a1', role: 'admin', status: 'active' } as never;

const ROW: ServiceReportRow = {
  line_id: 'l1',
  order_id: 'o2',
  order_number: 2,
  closed_at: '2026-10-15T15:00:00-05:00',
  customer_name: 'Camila Cliente',
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
  service_name: 'Lavado detallado',
  price: 40000,
  employees: [{ name: 'Elkin Estrada', share: 100 }],
};

const request = (query: string) =>
  new NextRequest(`http://localhost:3000/reports/services/export${query}`);

describe('GET /reports/services/export', () => {
  beforeEach(() =>
    vi.mocked(getServiceReport).mockResolvedValue({
      rows: [ROW],
      totals: { services: 1, subtotal: 40000, discounts: 0, total: 40000 },
    })
  );
  afterEach(() => vi.clearAllMocks());

  it('answers 403 to anyone who is not an active admin, without reading the report (CA-14)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    const response = await GET(request('?from=2026-10-01&to=2026-10-31'));

    expect(response.status).toBe(403);
    expect(getServiceReport).not.toHaveBeenCalled();
  });

  it('reads every row of the filters of the address, as the screen reads them (CA-12, RF-02)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);

    await GET(request('?from=2026-10-01&to=2026-10-31&plate=uih-03d&page=3'));

    expect(getServiceReport).toHaveBeenCalledWith(
      { from: '2026-10-01', to: '2026-10-31', employee: null, plate: 'UIH03D', page: 1 },
      { all: true }
    );
  });

  it('gives the admin an Excel file named by its period (CA-12)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);

    const response = await GET(request('?from=2026-10-01&to=2026-10-31'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="servicios-2026-10-01-a-2026-10-31.xlsx"'
    );
    // Nobody's report stays in a shared cache.
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
  });
});
