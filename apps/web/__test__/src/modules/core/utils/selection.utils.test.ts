/**
 * singleOption — a list with only one possible choice comes already chosen (spec 008, RN-10).
 *
 * The rule of the whole interface: the only vehicle of a customer, the only active employee… are
 * preselected, so nobody has to open a list to pick the one thing in it.
 */
import { singleOption } from '@web/modules/core/utils/selection.utils';

describe('singleOption', () => {
  it('returns the only item of a list of one', () => {
    expect(singleOption([{ id: 'v1' }])).toEqual({ id: 'v1' });
  });

  it.each([
    ['empty', []],
    ['with several items', [{ id: 'v1' }, { id: 'v2' }]],
  ])('returns nothing for a list %s: the person chooses', (_, items) => {
    expect(singleOption(items)).toBeUndefined();
  });
});
