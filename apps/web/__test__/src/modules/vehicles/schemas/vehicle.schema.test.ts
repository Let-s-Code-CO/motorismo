/**
 * vehicle.schema — the vehicle form (spec 005, HU-01 / HU-05 / HU-06).
 *
 * The same schema validates the form in the browser and the Server Action input. It mirrors the
 * database rules so the user sees every problem next to its field at once (CA-07):
 * - brand and colour always; the line on motorcycles and cars (optional on bicycles);
 * - the plate on motorcycles and cars, in the shape of the type (CA-05, RN-03); never on bicycles;
 * - the class on cars (Automóvil, Camioneta) and bicycles (Montaña, Ruta), never preselected;
 * - the displacement only on motorcycles, optional, 50–2500 cc (RN-09);
 * - what does not belong to the type is dropped from the output, so a stale value left in the form
 *   after changing the type is never saved (CA-09). Errors are message keys (vehicles.validation);
 * - the city that issued the plate, only on cars and required there (RN-11, CA-07); a stale one
 *   is dropped from motorcycles and bicycles (CA-09, CA-31).
 */
import {
  type VehicleFormInput,
  vehicleFormSchema,
} from '@web/modules/vehicles/schemas/vehicle.schema';

const build = (overrides: Partial<VehicleFormInput> = {}): VehicleFormInput => ({
  vehicle_type: 'motorcycle',
  vehicle_class: null,
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  displacement_cc: 600,
  color: 'black',
  plate: 'uih-03d',
  ...overrides,
});

const errorsOf = (input: VehicleFormInput) => {
  const result = vehicleFormSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message])
  );
};

describe('vehicleFormSchema — a valid vehicle of each type', () => {
  it('accepts a motorcycle and normalises its plate (CA-03)', () => {
    expect(vehicleFormSchema.parse(build())).toEqual({
      vehicle_type: 'motorcycle',
      vehicle_class: null,
      brand_name: 'Suzuki',
      line_name: 'GSX-R600',
      displacement_cc: 600,
      color: 'black',
      plate: 'UIH03D',
      plate_city_code: null,
    });
  });

  it('accepts a car with its class and drops a stale displacement (CA-05, CA-09)', () => {
    expect(
      vehicleFormSchema.parse(
        build({
          vehicle_type: 'car',
          vehicle_class: 'utility',
          plate: 'abc 123',
          line_name: 'CX-30',
          plate_city_code: '25377',
        })
      )
    ).toMatchObject({
      vehicle_class: 'utility',
      displacement_cc: null,
      plate: 'ABC123',
      plate_city_code: '25377',
    });
  });

  it('accepts a bicycle without line and drops a stale plate and displacement (CA-06, CA-09)', () => {
    expect(
      vehicleFormSchema.parse(
        build({ vehicle_type: 'bicycle', vehicle_class: 'road', line_name: '  ', plate: 'UIH03D' })
      )
    ).toMatchObject({ vehicle_class: 'road', line_name: null, plate: null, displacement_cc: null });
  });

  it('drops a stale plate city from a motorcycle and a bicycle: only cars keep one (CA-09, CA-31)', () => {
    expect(vehicleFormSchema.parse(build({ plate_city_code: '11001' })).plate_city_code).toBeNull();
    expect(
      vehicleFormSchema.parse(
        build({
          vehicle_type: 'bicycle',
          vehicle_class: 'road',
          plate: null,
          plate_city_code: '11001',
        })
      ).plate_city_code
    ).toBeNull();
  });

  it('drops a stale class from a motorcycle (CA-09)', () => {
    expect(
      vehicleFormSchema.parse(build({ vehicle_class: 'automobile' })).vehicle_class
    ).toBeNull();
  });

  it('accepts a motorcycle without displacement (it is optional, RN-09)', () => {
    expect(vehicleFormSchema.parse(build({ displacement_cc: null })).displacement_cc).toBeNull();
    expect(
      vehicleFormSchema.parse(build({ displacement_cc: Number.NaN })).displacement_cc
    ).toBeNull();
  });

  it('accepts the limits of the displacement range: 50 and 2500 cc', () => {
    expect(vehicleFormSchema.safeParse(build({ displacement_cc: 50 })).success).toBe(true);
    expect(vehicleFormSchema.safeParse(build({ displacement_cc: 2500 })).success).toBe(true);
  });

  it('parses its own output again unchanged (the Server Action re-validates what the form sent)', () => {
    const once = vehicleFormSchema.parse(build());
    expect(vehicleFormSchema.parse(once)).toEqual(once);
  });
});

describe('vehicleFormSchema — errors next to each field (CA-07)', () => {
  it('reports every missing field of a motorcycle at once', () => {
    expect(
      errorsOf(build({ brand_name: ' ', line_name: '', color: undefined, plate: '' }))
    ).toEqual({
      brand_name: 'brandRequired',
      line_name: 'lineRequired',
      color: 'colorRequired',
      plate: 'plateRequired',
    });
  });

  it('requires the class of a car and of a bicycle, never preselected (RN-10)', () => {
    expect(
      errorsOf(build({ vehicle_type: 'car', plate: 'ABC123', plate_city_code: '11001' }))
    ).toEqual({
      vehicle_class: 'classRequired',
    });
    expect(errorsOf(build({ vehicle_type: 'bicycle', plate: null }))).toEqual({
      vehicle_class: 'classRequired',
    });
  });

  it('rejects a class of another type (a car cannot be "Montaña")', () => {
    expect(
      errorsOf(
        build({
          vehicle_type: 'car',
          vehicle_class: 'mountain',
          plate: 'ABC123',
          plate_city_code: '11001',
        })
      )
    ).toEqual({ vehicle_class: 'classRequired' });
  });

  it('rejects a plate in the shape of another type (CA-05)', () => {
    expect(errorsOf(build({ plate: 'ABC123' }))).toEqual({ plate: 'plateInvalid' });
    expect(
      errorsOf(
        build({
          vehicle_type: 'car',
          vehicle_class: 'automobile',
          plate: 'UIH03D',
          plate_city_code: '11001',
        })
      )
    ).toEqual({ plate: 'plateInvalid' });
  });

  it('rejects a displacement out of range: 49 and 2501 cc (RN-09)', () => {
    expect(errorsOf(build({ displacement_cc: 49 }))).toEqual({
      displacement_cc: 'displacementInvalid',
    });
    expect(errorsOf(build({ displacement_cc: 2501 }))).toEqual({
      displacement_cc: 'displacementInvalid',
    });
  });

  it('requires the city of a car plate, empty or missing (CA-07, RN-11)', () => {
    const car = { vehicle_type: 'car', vehicle_class: 'automobile', plate: 'ABC123' } as const;
    expect(errorsOf(build({ ...car, plate_city_code: null }))).toEqual({
      plate_city_code: 'plateCityRequired',
    });
    expect(errorsOf(build({ ...car, plate_city_code: '' }))).toEqual({
      plate_city_code: 'plateCityRequired',
    });
  });

  it('rejects brand and line names longer than the catalog allows (60 characters)', () => {
    expect(errorsOf(build({ brand_name: 'x'.repeat(61), line_name: 'y'.repeat(61) }))).toEqual({
      brand_name: 'nameTooLong',
      line_name: 'nameTooLong',
    });
  });
});
