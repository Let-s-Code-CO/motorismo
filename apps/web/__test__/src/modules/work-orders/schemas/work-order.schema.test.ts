/**
 * workOrderSchema — the order form, checked before anything is sent (spec 008, HU-01).
 *
 * Guards:
 * - CA-09 / RN-02: a line's price is whole pesos from $ 0 to $ 10.000.000 ($ 0 is a courtesy).
 * - CA-05: an «Otro» line needs a description.
 * - CA-06 / RN-03: if a line has employees, their shares are whole percentages adding up to 100
 *   (a line may still have none while the order is open: closing checks that, CA-12).
 * - CA-28 / RN-11: a line's time is optional, 5 to 1.440 minutes.
 * - CA-25: the discount is whole pesos from 0 to the subtotal.
 * - CA-07: an order has a customer, a vehicle and at least one line.
 * - The Server Action parses the form's output again: numbers are accepted as they are.
 */
import { workOrderSchema } from '@web/modules/work-orders/schemas/work-order.schema';

const CUSTOMER = '10000000-0000-4000-8000-000000000001';
const VEHICLE = '20000000-0000-4000-8000-000000000001';
const SERVICE = '30000000-0000-4000-8000-000000000001';
const ELENA = '40000000-0000-4000-8000-000000000001';
const PEDRO = '40000000-0000-4000-8000-000000000002';

const line = (overrides: Record<string, unknown> = {}) => ({
  id: null,
  service_id: SERVICE,
  name: 'Lavado detallado',
  price: '60.000',
  estimated_minutes: '90',
  employees: [{ employee_id: ELENA, share_pct: '100' }],
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  customer_id: CUSTOMER,
  vehicle_id: VEHICLE,
  lines: [line()],
  discount: '',
  notes: '',
  ...overrides,
});

const issuesOf = (value: unknown) => {
  const result = workOrderSchema.safeParse(value);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
};

describe('workOrderSchema', () => {
  it('turns typed values into numbers, blank ones into their default (CA-04)', () => {
    expect(workOrderSchema.parse(order())).toEqual({
      customer_id: CUSTOMER,
      vehicle_id: VEHICLE,
      lines: [
        {
          id: null,
          service_id: SERVICE,
          name: 'Lavado detallado',
          price: 60000,
          estimated_minutes: 90,
          employees: [{ employee_id: ELENA, share_pct: 100 }],
        },
      ],
      discount: 0,
      notes: null,
    });
  });

  it('accepts its own output again, as the Server Action does', () => {
    const parsed = workOrderSchema.parse(order());

    expect(workOrderSchema.parse(parsed)).toEqual(parsed);
  });

  it('accepts a courtesy line of $ 0 and a line without employees yet (CA-12 checks them on closing)', () => {
    expect(issuesOf(order({ lines: [line({ price: '0', employees: [] })] }))).toEqual({});
  });

  it.each(['-1', '10.000.001', '12,5', 'mucho', ''])(
    'refuses «%s» as a price (CA-09, RN-02)',
    (price) => {
      expect(issuesOf(order({ lines: [line({ price })] }))).toEqual({
        'lines.0.price': 'priceInvalid',
      });
    }
  );

  it('requires a description for «Otro» (CA-05)', () => {
    expect(issuesOf(order({ lines: [line({ service_id: null, name: '  ' })] }))).toEqual({
      'lines.0.name': 'otherNameRequired',
    });
  });

  it('requires the shares of a line to add up to 100 (CA-06, RN-03)', () => {
    expect(
      issuesOf(
        order({
          lines: [
            line({
              employees: [
                { employee_id: ELENA, share_pct: '60' },
                { employee_id: PEDRO, share_pct: '30' },
              ],
            }),
          ],
        })
      )
    ).toEqual({ 'lines.0.employees': 'sharesInvalid' });
  });

  it.each(['4', '1441', '1.5'])('refuses «%s» minutes (RN-11)', (minutes) => {
    expect(issuesOf(order({ lines: [line({ estimated_minutes: minutes })] }))).toEqual({
      'lines.0.estimated_minutes': 'minutesInvalid',
    });
  });

  it('accepts a line without time (CA-28)', () => {
    expect(
      workOrderSchema.parse(order({ lines: [line({ estimated_minutes: '' })] })).lines[0]
    ).toMatchObject({ estimated_minutes: null });
  });

  it('refuses a discount above the subtotal or negative (CA-25)', () => {
    expect(issuesOf(order({ discount: '60.001' }))).toEqual({ discount: 'discountInvalid' });
    expect(issuesOf(order({ discount: '-1' }))).toEqual({ discount: 'discountInvalid' });
    expect(issuesOf(order({ discount: '60.000' }))).toEqual({});
  });

  it('requires a vehicle and at least one line (CA-07)', () => {
    expect(issuesOf(order({ vehicle_id: '', lines: [] }))).toEqual({
      vehicle_id: 'vehicleRequired',
      lines: 'linesRequired',
    });
  });

  it('refuses notes longer than 500 characters', () => {
    expect(issuesOf(order({ notes: 'x'.repeat(501) }))).toEqual({ notes: 'notesTooLong' });
  });
});
