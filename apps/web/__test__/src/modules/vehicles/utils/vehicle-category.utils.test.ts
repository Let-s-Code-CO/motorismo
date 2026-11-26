/**
 * vehicle-category.utils — the category that counts for a motorcycle (spec 024, RN-04): its own, given
 * by staff (CA-03), or else its line's (CA-02); none when neither has one (CA-06, CA-18).
 */
import { vehicleCategory } from '@web/modules/vehicles/utils/vehicle-category.utils';

describe('vehicleCategory', () => {
  it('is the motorcycle’s own when staff gave it one (CA-03)', () => {
    expect(
      vehicleCategory({ motorcycle_category: 'trail', line: { motorcycle_category: 'street' } })
    ).toBe('trail');
  });

  it('is its line’s otherwise (CA-02)', () => {
    expect(
      vehicleCategory({ motorcycle_category: null, line: { motorcycle_category: 'sbk' } })
    ).toBe('sbk');
  });

  it('is none without either, or without line (CA-06, CA-18)', () => {
    expect(
      vehicleCategory({ motorcycle_category: null, line: { motorcycle_category: null } })
    ).toBeNull();
    expect(vehicleCategory({ motorcycle_category: null, line: null })).toBeNull();
  });
});
