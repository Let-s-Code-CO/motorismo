/**
 * paymentsSchema — how the customer paid, when the order is closed (spec 008, HU-02).
 *
 * Guards:
 * - CA-11 / RN-09: one or more payments (cash, transfer, card or other), each a whole amount
 *   above $ 0, adding up to exactly the total.
 * - CA-12: when they do not add up, the form says so.
 * - CA-13: an order of $ 0 needs no payment.
 */
import { paymentsSchema } from '@web/modules/work-orders/schemas/payments.schema';

const issuesOf = (total: number, payments: unknown[]) => {
  const result = paymentsSchema(total).safeParse({ payments });
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
};

describe('paymentsSchema', () => {
  it('accepts two methods adding up to the total, as whole pesos (CA-11)', () => {
    expect(
      paymentsSchema(25000).parse({
        payments: [
          { method: 'cash', amount: '15.000' },
          { method: 'transfer', amount: 10000 },
        ],
      })
    ).toEqual({
      payments: [
        { method: 'cash', amount: 15000 },
        { method: 'transfer', amount: 10000 },
      ],
    });
  });

  it('says so when the payments do not add up to the total (CA-12)', () => {
    expect(issuesOf(25000, [{ method: 'cash', amount: '20.000' }])).toEqual({
      payments: 'paymentsMismatch',
    });
  });

  it.each(['0', '-5', '12,5', ''])('refuses «%s» as an amount', (amount) => {
    expect(issuesOf(25000, [{ method: 'cash', amount }])).toMatchObject({
      'payments.0.amount': 'amountInvalid',
    });
  });

  it('refuses an unknown method', () => {
    expect(issuesOf(25000, [{ method: 'bitcoin', amount: '25000' }])).toMatchObject({
      'payments.0.method': 'methodRequired',
    });
  });

  it('needs no payment for an order of $ 0 (CA-13)', () => {
    expect(issuesOf(0, [])).toEqual({});
  });

  it('needs at least one payment when there is something to pay (CA-11)', () => {
    expect(issuesOf(25000, [])).toEqual({ payments: 'paymentsMismatch' });
  });
});
