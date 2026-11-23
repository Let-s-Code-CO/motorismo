import { z } from 'zod';

import { fullNameField, optionalMobileField } from '@web/modules/core/schemas/fields.schema';
import { parsePesos } from '@web/modules/core/utils/money.utils';
import { DOCUMENT_TYPES } from '@web/modules/employees/constants/employees.constants';

/** CA-09: «1.020.304.050», «1020 304 050» and «1020-304-050» are the same document. */
export const normalizeDocument = (raw: string) => raw.replace(/[\s.-]/g, '').toUpperCase();

/** RN-04: digits for CC, CE and PPT (3 to 15); letters and digits for a passport (5 to 20). */
const DOCUMENT_PATTERN = {
  cc: /^[0-9]{3,15}$/,
  ce: /^[0-9]{3,15}$/,
  ppt: /^[0-9]{3,15}$/,
  passport: /^[A-Z0-9]{5,20}$/,
} as const;

/** RN-06: a whole percentage from 0 to 100, typed as text or already a number. */
const commissionField = z.union([z.number(), z.string()]).transform((raw, ctx) => {
  const text = String(raw).trim();
  if (!text) {
    ctx.addIssue({ code: 'custom', message: 'commissionRequired' });
    return 0;
  }
  const value = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    ctx.addIssue({ code: 'custom', message: 'commissionInvalid' });
    return 0;
  }
  return value;
});

/**
 * Spec 016, CA-01 / CA-02: the monthly base salary in whole pesos, typed as staff write it
 * («1.300.000», «$ 1.300.000») or already a number; 0 or more.
 */
const baseSalaryField = z.union([z.number(), z.string()]).transform((raw, ctx) => {
  if (typeof raw === 'number') {
    if (Number.isInteger(raw) && raw >= 0) return raw;
    ctx.addIssue({ code: 'custom', message: 'baseSalaryInvalid' });
    return 0;
  }
  if (!raw.trim()) {
    ctx.addIssue({ code: 'custom', message: 'baseSalaryRequired' });
    return 0;
  }
  const value = parsePesos(raw);
  if (value === null) {
    ctx.addIssue({ code: 'custom', message: 'baseSalaryInvalid' });
    return 0;
  }
  return value;
});

/**
 * An employee of the catalog (spec 007, HU-02). Errors are message keys under
 * `employees.validation`. The document is checked against its type even when other fields fail,
 * so the form shows every problem at once (CA-08).
 */
export const employeeSchema = z
  .object({
    full_name: fullNameField,
    document_type: z.enum(DOCUMENT_TYPES, { error: 'documentTypeRequired' }),
    document_number: z
      .string({ error: 'documentRequired' })
      .transform(normalizeDocument)
      .pipe(z.string().min(1, { error: 'documentRequired' })),
    phone: optionalMobileField,
    commission_pct: commissionField,
    base_salary: baseSalaryField,
  })
  .refine(
    ({ document_type, document_number }) =>
      // Only judged when both are there; a missing one already has its own error.
      !document_number ||
      !(document_type in DOCUMENT_PATTERN) ||
      DOCUMENT_PATTERN[document_type].test(document_number),
    { path: ['document_number'], error: 'documentInvalid', when: () => true }
  );

export type EmployeeInput = z.input<typeof employeeSchema>;
export type EmployeeValues = z.output<typeof employeeSchema>;
