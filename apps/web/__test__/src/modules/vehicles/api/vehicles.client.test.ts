/**
 * vehicles.client — the plate cities read from the browser (spec 005, HU-07, RF-07).
 *
 * The form lists every municipality of Colombia (1,104) for the city of a car plate (CA-30). The
 * API answers at most 1,000 rows per request (PostgREST max_rows, the Supabase default), so a
 * single request would silently lose the last 104: the list is read page by page, in a stable
 * order (by DANE code), until a page comes back incomplete.
 * Spec 023, CA-07: only the municipalities that issue plates (with a transit authority, RN-04).
 */
import { createSupabaseBrowserClient } from '@web/modules/core/lib/supabase-browser.lib';
import { fetchMunicipalities } from '@web/modules/vehicles/api/vehicles.client';
import type { Municipality } from '@web/modules/vehicles/types/vehicles.types';

vi.mock('@web/modules/core/lib/supabase-browser.lib', () => ({
  createSupabaseBrowserClient: vi.fn(),
}));

const API_MAX_ROWS = 1000;

const municipalities = (count: number): Municipality[] =>
  Array.from({ length: count }, (_, index) => ({
    code: String(index + 1).padStart(5, '0'),
    name: `Municipio ${index + 1}`,
    department: 'Departamento',
  }));

/** A fake API that, like PostgREST, never returns more than 1,000 rows per request. */
const fakeApi = (rows: Municipality[]) => {
  const range = vi.fn((from: number, to: number) =>
    Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + API_MAX_ROWS)), error: null })
  );
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  vi.mocked(createSupabaseBrowserClient).mockReturnValue({ from: () => query } as never);
  return query;
};

describe('fetchMunicipalities', () => {
  afterEach(() => vi.clearAllMocks());

  it('loads all 1,104 municipalities although the API caps each answer at 1,000 rows (RF-07)', async () => {
    const query = fakeApi(municipalities(1104));

    const result = await fetchMunicipalities();

    expect(result).toHaveLength(1104);
    expect(result.at(-1)?.code).toBe('01104');
    // Two pages: rows 0–999 and 1000–1999 (the second comes back with 104, so it stops).
    expect(query.range.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    expect(query.order).toHaveBeenCalledWith('code');
  });

  it('asks once more when a page is exactly full, and stops on the empty one (1,000 rows)', async () => {
    const query = fakeApi(municipalities(1000));

    expect(await fetchMunicipalities()).toHaveLength(1000);
    expect(query.range).toHaveBeenCalledTimes(2);
  });

  it('asks only for the municipalities that issue plates (spec 023, CA-07)', async () => {
    const query = fakeApi(municipalities(3));

    await fetchMunicipalities();

    expect(query.eq).toHaveBeenCalledWith('issues_plates', true);
  });

  it('fails loudly when the API refuses, instead of returning a partial list', async () => {
    const query = fakeApi([]);
    query.range.mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never);

    await expect(fetchMunicipalities()).rejects.toThrow('Could not load the municipalities: boom');
  });
});
