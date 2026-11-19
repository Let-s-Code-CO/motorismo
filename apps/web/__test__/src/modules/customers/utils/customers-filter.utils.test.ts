/**
 * customers-filter.utils — the state of the customer list in the URL (spec 004, HU-04).
 *
 * `?q=…&status=…&page=…` survives a reload and the "back" button (standard of summary cards as
 * filters). Guards:
 * - CA-16: the search ignores case and accents, exactly like the database's search text, and a
 *   user's `%` or `_` are searched literally (never as wildcards).
 * - CA-17: anything that is not a known status means "no filter" (never an empty list).
 * - RF-05: pages of 20; a missing, zero, negative or non-numeric page is page 1.
 */
import {
  CUSTOMERS_PAGE_SIZE,
  customersQueryString,
  normalizeSearch,
  pageCount,
  pageRange,
  parseCustomerFilters,
  toLikePattern,
} from '@web/modules/customers/utils/customers-filter.utils';

describe('parseCustomerFilters', () => {
  it('reads search, status and page', () => {
    expect(parseCustomerFilters({ q: ' josé ', status: 'walk_in', page: '3' })).toEqual({
      q: 'josé',
      status: 'walk_in',
      page: 3,
    });
  });

  it('defaults to no search, no filter and page 1', () => {
    expect(parseCustomerFilters({})).toEqual({ q: '', status: null, page: 1 });
  });

  it.each(['', 'WALK_IN', 'deleted', 'registered,disabled'])('ignores the status %j', (status) => {
    expect(parseCustomerFilters({ status }).status).toBeNull();
  });

  it.each(['0', '-2', 'abc', '2.5', ''])('treats the page %j as page 1', (page) => {
    expect(parseCustomerFilters({ page }).page).toBe(1);
  });

  it('cuts a search longer than 100 characters', () => {
    expect(parseCustomerFilters({ q: 'a'.repeat(150) }).q).toHaveLength(100);
  });
});

describe('normalizeSearch', () => {
  it.each([
    ['José Pérez', 'jose perez'],
    ['  ANDRÉS   ñáñez ', 'andres nanez'],
    ['300 123', '300 123'],
  ])('turns %j into %j (CA-16)', (raw, expected) => {
    expect(normalizeSearch(raw)).toBe(expected);
  });
});

describe('toLikePattern', () => {
  it('wraps the normalised search to match any part of the text', () => {
    expect(toLikePattern('José')).toBe('%jose%');
  });

  it('escapes % and _ so they are searched literally', () => {
    expect(toLikePattern('50%_off')).toBe('%50\\%\\_off%');
  });
});

describe('pages', () => {
  it('uses pages of 20 customers (RF-05)', () => {
    expect(CUSTOMERS_PAGE_SIZE).toBe(20);
  });

  it('gives the inclusive row range of a page', () => {
    // page 3 = rows 40..59 (0-based, 20 per page)
    expect(pageRange(3)).toEqual([40, 59]);
  });

  it.each([
    [0, 1],
    [20, 1],
    [21, 2],
    [45, 3],
  ])('%i customers make %i page(s)', (total, pages) => {
    expect(pageCount(total)).toBe(pages);
  });
});

describe('customersQueryString', () => {
  it('keeps only what differs from the defaults', () => {
    expect(customersQueryString({ q: 'jose', status: 'registered', page: 2 })).toBe(
      '?q=jose&status=registered&page=2'
    );
    expect(customersQueryString({ q: '', status: null, page: 1 })).toBe('');
  });
});
