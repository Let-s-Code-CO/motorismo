/** Message keys under `reports.payroll.errors`. */
export type PayrollErrorKey =
  | 'forbidden'
  | 'invalidInput'
  | 'notFortnight'
  | 'periodOpen'
  | 'methodInvalid'
  | 'alreadyClosed'
  | 'notClosed'
  | 'generic';

const BY_HINT: Partial<Record<string, PayrollErrorKey>> = {
  payroll_period_open: 'periodOpen',
  payroll_not_fortnight: 'notFortnight',
  payroll_method_invalid: 'methodInvalid',
  payroll_already_closed: 'alreadyClosed',
  payroll_not_closed: 'notClosed',
  payroll_admin_only: 'forbidden',
};

/** Refusals of close_payroll / regenerate_payroll (spec 020; spec 016) → message keys. */
export const fromPayrollError = (error: {
  code?: string;
  hint?: string | null;
}): PayrollErrorKey => {
  const byHint = error.hint ? BY_HINT[error.hint] : undefined;
  if (byHint) return byHint;
  if (error.code === '42501') return 'forbidden';
  return 'generic';
};
