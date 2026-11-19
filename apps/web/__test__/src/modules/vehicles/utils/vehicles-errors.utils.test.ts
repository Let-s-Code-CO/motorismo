/**
 * vehicles-errors.utils — database refusals of a vehicle turned into messages (spec 005).
 *
 * The database decides (vehicles_guard, RLS, save_vehicle) and answers with a hint; the app turns
 * it into a message key under `vehicles.errors`. The taken plate has two wordings (RN-08: neither
 * says whose vehicle it is):
 * - staff: "Ya hay un vehículo registrado con esta placa." (CA-08);
 * - a customer: the same, plus "Si es tuyo, acércate al punto de atención." (CA-25).
 */
import { fromVehicleError } from '@web/modules/vehicles/utils/vehicles-errors.utils';

describe('fromVehicleError', () => {
  it('tells staff that the plate is taken (CA-08)', () => {
    expect(fromVehicleError({ hint: 'vehicle_plate_taken' }, 'staff')).toBe('plateTaken');
  });

  it('tells a customer that the plate is taken and where to go (CA-25)', () => {
    expect(fromVehicleError({ hint: 'vehicle_plate_taken' }, 'customer')).toBe(
      'plateTakenCustomer'
    );
  });

  it('treats a race on the unique plate index (23505, no hint) as a taken plate too', () => {
    expect(fromVehicleError({ code: '23505' }, 'staff')).toBe('plateTaken');
    expect(fromVehicleError({ code: '23505' }, 'customer')).toBe('plateTakenCustomer');
  });

  it.each([
    ['vehicle_plate_required', 'plateRequired'],
    ['vehicle_plate_invalid', 'plateInvalid'],
    ['vehicle_class_required', 'classRequired'],
    ['vehicle_line_required', 'lineRequired'],
    ['vehicle_brand_required', 'brandRequired'],
    ['vehicle_displacement_invalid', 'displacementInvalid'],
    ['vehicle_retired', 'retired'],
    ['vehicle_not_found', 'notFound'],
  ])('maps the hint %s to %s', (hint, key) => {
    expect(fromVehicleError({ hint }, 'staff')).toBe(key);
  });

  it('maps a row-level security refusal (42501) to "forbidden" (e.g. a disabled customer)', () => {
    expect(fromVehicleError({ code: '42501' }, 'staff')).toBe('forbidden');
  });

  it('maps anything else to a generic error', () => {
    expect(fromVehicleError({ code: 'XX000', hint: null }, 'staff')).toBe('generic');
  });
});
