import { z } from 'zod';

import { PAYMENT_METHODS } from '@web/modules/work-orders/constants/work-orders.constants';
import { wholeField } from '@web/modules/work-orders/schemas/fields.schema';

const paymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS, { error: 'methodRequired' }),
  amount: wholeField({ min: 1, max: 100_000_000, error: 'amountInvalid', pesos: true }),
});

/** The payments as sent to close an order; the database checks they add up (RN-09). */
export const paymentListSchema = z.object({ payments: z.array(paymentSchema) });

/**
 * The closing form (spec 008, HU-02): one or more payments adding up to exactly the total (CA-11,
 * CA-12); an order of $ 0 needs none (CA-13). Errors are message keys under `orders.validation`.
 */
export const paymentsSchema = (total: number) =>
  paymentListSchema.refine(
    ({ payments }) => payments.reduce((sum, { amount }) => sum + (amount ?? 0), 0) === total,
    { path: ['payments'], error: 'paymentsMismatch', when: () => true }
  );

export type PaymentsInput = z.input<ReturnType<typeof paymentsSchema>>;
export type PaymentsValues = z.output<ReturnType<typeof paymentsSchema>>;
