/**
 * status-filter.utils — the standard "summary cards as filters" (spec 003, CA-09; spec 004, CA-17).
 *
 * The filter lives in the URL (?status=…) so it survives a reload; anything that is not one of the
 * allowed values is ignored (no filter) rather than producing an empty list.
 */
import { filterByStatus, parseStatusParam } from '@web/modules/core/utils/status-filter.utils';

const STATUSES = ['active', 'invited', 'disabled'] as const;

describe('parseStatusParam', () => {
  it.each(STATUSES)('accepts %s', (status) => {
    expect(parseStatusParam(status, STATUSES)).toBe(status);
  });

  it.each([null, undefined, '', 'ACTIVE', 'deleted', 'invited,active'])('ignores %s', (raw) => {
    expect(parseStatusParam(raw, STATUSES)).toBeNull();
  });
});

describe('filterByStatus', () => {
  type Status = (typeof STATUSES)[number];
  const rows: { id: string; status: Status }[] = [
    { id: 'a', status: 'active' },
    { id: 'b', status: 'invited' },
    { id: 'c', status: 'active' },
  ];

  it('keeps only the rows with the chosen status, in order', () => {
    expect(filterByStatus(rows, 'active').map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it('returns every row without a filter', () => {
    expect(filterByStatus(rows, null)).toHaveLength(3);
  });
});
