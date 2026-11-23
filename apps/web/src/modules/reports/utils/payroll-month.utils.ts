/**
 * The month of the payroll (spec 016), as `YYYY-MM`. Date-only arithmetic on UTC midnights, so no
 * device's time zone moves a month.
 */
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const PAYROLL_PATH = '/reports/payroll';

const shift = (month: string, by: number) => {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, number - 1 + by, 1));
  return date.toISOString().slice(0, 7);
};

/** The month in progress, from today in Colombia (`YYYY-MM-DD`). */
export const monthOf = (today: string) => today.slice(0, 7);

/** The month of the address, or the month in progress when it is missing, wrong or to come (CA-05). */
export const parsePayrollMonth = (raw: string | string[] | undefined, today: string) => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const current = monthOf(today);
  return value && MONTH.test(value) && value <= current ? value : current;
};

export const previousMonth = (month: string) => shift(month, -1);

/** The next month, or null after the month in progress (nothing to pay yet). */
export const nextMonth = (month: string, today: string) => {
  const next = shift(month, 1);
  return next <= monthOf(today) ? next : null;
};

/** The month for the database: its first day. */
export const monthStart = (month: string) => `${month}-01`;

const LABEL = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** «Noviembre de 2026». */
export const monthLabel = (month: string) => {
  const label = LABEL.format(new Date(`${monthStart(month)}T12:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const payrollHref = (month: string) => `${PAYROLL_PATH}?month=${month}`;
export const payrollEmployeeHref = (month: string, employeeId: string) =>
  `${PAYROLL_PATH}/${employeeId}?month=${month}`;
export const payrollExportHref = (month: string) => `${PAYROLL_PATH}/export?month=${month}`;
