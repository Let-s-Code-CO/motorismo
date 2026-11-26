/**
 * customers-filter.utils — the state of the customer list in the URL (spec 004, HU-04).
 *
 * `?q=…&status=…&page=…` survives a reload and the "back" button (standard of summary cards as
 * filters). Guards:
 * - CA-16: the search ignores case and accents, exactly like the database's search text, and a
 *   user's `%` or `_` are searched literally (never as wildcards).
 * - CA-17: the filter is a status or "active" (with or without account, not disabled); anything
 *   else means "no filter" (never an empty list).
 * - RF-05: pages of 20; a missing, zero, negative or non-numeric page is page 1.
 * - CA-33: a record opened from the list carries the list's state, so «Volver a clientes» returns to
 *   the same filter, search and page; anything else in that state is ignored (it only ever leads back
 *   to the list).
 * - spec 005, CA-17 / CA-19: a plate is found written any way ("UIH-03", "uih 03": the database
 *   keeps plates without separators), and the row shows which plate matched.
 */
import {
  CUSTOMERS_PAGE_SIZE,
  activeCount,
  customerRecordHref,
  customersListHref,
  customersQueryString,
  matchingPlate,
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

  it('accepts "active": customers with or without account, not disabled (CA-17)', () => {
    expect(parseCustomerFilters({ status: 'active' }).status).toBe('active');
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

describe('normalizeSearch — plates (spec 005, CA-17)', () => {
  it.each([
    ['UIH-03', 'uih03'],
    ['uih 03', 'uih03'],
    ['UIH-03D', 'uih03d'],
    ['abc 123', 'abc123'],
  ])('searches the plate "%s" without separators: "%s"', (raw, expected) => {
    expect(normalizeSearch(raw)).toBe(expected);
  });

  it.each([
    ['ana-maría', 'ana-maria'],
    ['José Pérez', 'jose perez'],
    ['300 123', '300 123'],
  ])('leaves "%s" as a name or phone search: "%s"', (raw, expected) => {
    expect(normalizeSearch(raw)).toBe(expected);
  });
});

describe('matchingPlate (spec 005, CA-19)', () => {
  it('gives the plate of the customer that the search matched', () => {
    expect(matchingPlate('UIH03D ABC123', 'uih-03')).toBe('UIH03D');
    expect(matchingPlate('UIH03D ABC123', 'abc 12')).toBe('ABC123');
  });

  it('gives nothing when the search matched the name, email or phone (not a plate)', () => {
    expect(matchingPlate('UIH03D', 'camila')).toBeNull();
    expect(matchingPlate('', 'uih03')).toBeNull();
    expect(matchingPlate('UIH03D', '')).toBeNull();
  });

  it('needs at least three characters, so a single letter does not "match" every plate', () => {
    expect(matchingPlate('UIH03D', 'u')).toBeNull();
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

describe('activeCount', () => {
  it('adds customers with and without account, leaving out the disabled ones (CA-17)', () => {
    // 3 with account + 2 without = 5 active; the disabled one does not count.
    expect(activeCount({ registered: 3, walk_in: 2, disabled: 1 })).toBe(5);
  });
});

describe('customerRecordHref and customersListHref (CA-33)', () => {
  it('opens a record carrying the list it came from, and goes back to that list', () => {
    const href = customerRecordHref('c-1', { q: 'uih 03', status: 'active', page: 2 });

    expect(href).toBe('/customers/c-1?list=q%3Duih%2B03%26status%3Dactive%26page%3D2');
    const list = new URL(href, 'https://app.test').searchParams.get('list');
    expect(customersListHref(list)).toBe('/customers?q=uih+03&status=active&page=2');
  });

  it('opens a record from the whole list without anything to carry', () => {
    expect(customerRecordHref('c-1', { q: '', status: null, page: 1 })).toBe('/customers/c-1');
  });

  it.each([
    [undefined, '/customers'],
    ['', '/customers'],
    // Only the list's own state comes back: never another address, never an invalid filter.
    ['status=nope&page=-1&next=https://evil.test', '/customers'],
    ['q=ana&admin=1', '/customers?q=ana'],
  ])('goes back from %s to %s', (list, href) => {
    expect(customersListHref(list)).toBe(href);
  });
});
