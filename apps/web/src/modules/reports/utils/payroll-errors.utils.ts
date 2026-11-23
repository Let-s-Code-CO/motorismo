/** Message keys under `reports.payroll.errors`. */
export type PayrollErrorKey =
  'forbidden' | 'invalidInput' | 'monthOpen' | 'alreadyClosed' | 'notClosed' | 'generic';

/** Refusals of close_payroll / regenerate_payroll (spec 016) → message keys. */
export const fromPayrollError = (error: {
  code?: string;
  hint?: string | null;
}): PayrollErrorKey => {
  if (error.hint === 'payroll_month_open') return 'monthOpen';
  if (error.hint === 'payroll_already_closed') return 'alreadyClosed';
  if (error.hint === 'payroll_not_closed') return 'notClosed';
  if (error.hint === 'payroll_admin_only' || error.code === '42501') return 'forbidden';
  return 'generic';
};
