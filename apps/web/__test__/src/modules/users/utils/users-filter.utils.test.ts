/**
 * users-filter.utils — filtering the user list by status (spec 003, CA-09).
 *
 * The filter lives in the URL (?status=…) so it survives a reload; anything that is not a known
 * status is ignored (no filter) rather than producing an empty list.
 */
import {
  filterUsersByStatus,
  parseStatusFilter,
} from '@web/modules/users/utils/users-filter.utils';

import { buildProfile } from '@tests/test-utils/builders';

describe('parseStatusFilter', () => {
  it.each(['active', 'invited', 'disabled'] as const)('accepts %s', (status) => {
    expect(parseStatusFilter(status)).toBe(status);
  });

  it.each([null, undefined, '', 'ACTIVE', 'deleted', 'invited,active'])('ignores %s', (raw) => {
    expect(parseStatusFilter(raw)).toBeNull();
  });
});

describe('filterUsersByStatus', () => {
  const users = [
    buildProfile({ id: 'a', status: 'active' }),
    buildProfile({ id: 'b', status: 'invited' }),
    buildProfile({ id: 'c', status: 'active' }),
  ];

  it('keeps only the users with the chosen status, in order', () => {
    expect(filterUsersByStatus(users, 'active').map(({ id }) => id)).toEqual(['a', 'c']);
  });

  it('returns everyone without a filter', () => {
    expect(filterUsersByStatus(users, null)).toHaveLength(3);
  });
});
