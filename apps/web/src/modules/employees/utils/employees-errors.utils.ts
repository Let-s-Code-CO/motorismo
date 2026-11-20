/** Message keys under `employees.errors`. */
export type EmployeesErrorKey =
  'forbidden' | 'invalidInput' | 'documentTaken' | 'documentTakenDisabled' | 'notFound' | 'generic';

/** Database refusals (hints set by the employee guard and save_employee, spec 007) → message keys. */
export const fromEmployeesGuardError = (error: {
  code?: string;
  hint?: string | null;
}): EmployeesErrorKey => {
  if (error.hint === 'employee_document_taken') return 'documentTaken';
  if (error.hint === 'employee_document_taken_disabled') return 'documentTakenDisabled';
  if (error.hint === 'employee_not_found') return 'notFound';
  if (error.code === '42501') return 'forbidden';
  return 'generic';
};
