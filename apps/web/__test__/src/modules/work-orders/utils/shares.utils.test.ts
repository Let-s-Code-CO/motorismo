/**
 * splitShares — how a service line is shared among the employees who did it (spec 008, RN-03).
 *
 * Guards CA-06: the default is equal parts in whole percentages adding up to 100; what does not
 * divide evenly goes to the first ones (3 → 34/33/33). The staff can change it afterwards.
 */
import { splitShares } from '@web/modules/work-orders/utils/shares.utils';

describe('splitShares', () => {
  it.each([
    [1, [100]],
    [2, [50, 50]],
    [3, [34, 33, 33]],
    [6, [17, 17, 17, 17, 16, 16]],
    [0, []],
  ])('shares a line among %i employees as %j (they add up to 100)', (count, shares) => {
    expect(splitShares(count)).toEqual(shares);
    if (count) expect(splitShares(count).reduce((a, b) => a + b, 0)).toBe(100);
  });
});
