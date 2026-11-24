// @vitest-environment node
/**
 * The data files of spec 017: «Descargar mis datos» for the customer (CA-02) and a customer's data
 * for the admin (CA-17).
 *
 * Guards:
 * - CA-02 / CA-03: only an enabled customer downloads, and the file is theirs (`my_data`), named by
 *   the day in Colombia.
 * - CA-15 / CA-17: only an active admin downloads a customer's data; anyone else gets 403, without
 *   reading anything.
 * - The file is JSON, indented (a person and a program read it), never in a shared cache.
 */
import { GET as customerFile } from '@web/app/(app)/customers/[id]/data/export/route';
import { GET as myFile } from '@web/app/(app)/my/data/export/route';
import { getActiveAdmin, getActiveCustomer } from '@web/modules/auth/api/auth.server';
import { getCustomerData, getMyData } from '@web/modules/data-rights/api/data-rights.server';

import { buildCustomer, buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({
  getActiveAdmin: vi.fn(),
  getActiveCustomer: vi.fn(),
}));
vi.mock('@web/modules/data-rights/api/data-rights.server', () => ({
  getMyData: vi.fn(),
  getCustomerData: vi.fn(),
}));

const DATA = {
  profile: { full_name: 'Camila Cliente' },
  vehicles: [],
  orders: [],
  reservations: [],
  requests: [],
} as never;
const ID = '7a2d1e3f-9b5c-4d4e-8f60-1b2c3d4e5f60';
const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /my/data/export', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 24 Nov 2026 at 8 p. m. in Bogotá: already the 25th in UTC.
    vi.setSystemTime(new Date('2026-11-25T01:00:00Z'));
    vi.mocked(getMyData).mockResolvedValue(DATA);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('answers 403 to anyone who is not an enabled customer, without reading anything (CA-03)', async () => {
    vi.mocked(getActiveCustomer).mockResolvedValue(null);

    const response = await myFile();

    expect(response.status).toBe(403);
    expect(getMyData).not.toHaveBeenCalled();
  });

  it('gives the customer their data as JSON, named by the day in Colombia (CA-02)', async () => {
    vi.mocked(getActiveCustomer).mockResolvedValue(buildCustomer());

    const response = await myFile();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="mis-datos-2026-11-24.json"'
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const text = await response.text();
    expect(JSON.parse(text)).toEqual(DATA);
    // Indented: a person can read it.
    expect(text).toContain('\n  "profile": {');
  });
});

describe('GET /customers/[id]/data/export', () => {
  beforeEach(() => vi.mocked(getCustomerData).mockResolvedValue(DATA));
  afterEach(() => vi.clearAllMocks());

  it('answers 403 to anyone who is not an active admin, without reading anything (CA-15)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    const response = await customerFile(new Request('http://localhost'), context(ID));

    expect(response.status).toBe(403);
    expect(getCustomerData).not.toHaveBeenCalled();
  });

  it('gives the admin the customer’s data (CA-17)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(buildProfile({ role: 'admin' }));

    const response = await customerFile(new Request('http://localhost'), context(ID));

    expect(response.status).toBe(200);
    expect(getCustomerData).toHaveBeenCalledWith(ID);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="datos-cliente-\d{4}-\d{2}-\d{2}\.json"$/
    );
  });

  it('answers 404 to an address that is not a customer', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(buildProfile({ role: 'admin' }));

    const response = await customerFile(new Request('http://localhost'), context('no-es-un-id'));

    expect(response.status).toBe(404);
  });
});
