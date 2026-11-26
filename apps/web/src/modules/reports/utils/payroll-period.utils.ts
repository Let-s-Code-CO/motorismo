import type {
  PayrollMethod,
  PayrollPeriod,
  PayrollQuery,
} from '@web/modules/reports/types/reports.types';

/**
 * The period of the payroll (spec 020, RF-01): fortnights (the 1st to the 15th, the 16th to the last
 * day) and ranges, as `YYYY-MM-DD`. Date-only arithmetic on UTC midnights, so no device's time zone
 * moves a day.
 */
export const PAYROLL_PATH = '/reports/payroll';
export const DEFAULT_PAYROLL_METHOD: PayrollMethod = 'commercial';

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const lastDayOfMonth = (day: string) => {
  const date = utc(day);
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
};

/** The first day of the fortnight a day is in: the 1st or the 16th. */
export const fortnightOf = (day: string) =>
  `${day.slice(0, 8)}${Number(day.slice(8)) <= 15 ? '01' : '16'}`;

/** The last day of a fortnight: the 15th, or the last day of its month. */
export const fortnightEnd = (start: string) =>
  start.endsWith('-01') ? `${start.slice(0, 8)}15` : lastDayOfMonth(start);

/** 1 for the first fortnight of a month, 2 for the second. */
export const fortnightHalf = (start: string): 1 | 2 => (start.endsWith('-01') ? 1 : 2);

/** Whether two days are exactly a fortnight (CA-08). */
export const isFortnight = (from: string, to: string) =>
  fortnightOf(from) === from && fortnightEnd(from) === to;

export const previousFortnight = (start: string) => {
  const date = utc(start);
  date.setUTCDate(date.getUTCDate() - 1);
  return fortnightOf(iso(date));
};

/** The next fortnight, or null after the one in progress (nothing to pay yet, CA-01). */
export const nextFortnight = (start: string, today: string) => {
  const date = utc(fortnightEnd(start));
  date.setUTCDate(date.getUTCDate() + 1);
  const next = iso(date);
  return next <= fortnightOf(today) ? next : null;
};

/** A fortnight in the address: `2026-11-1` or `2026-11-2` (CA-10). */
export const fortnightParam = (start: string) => `${start.slice(0, 7)}-${fortnightHalf(start)}`;

const FORTNIGHT_PARAM = /^(\d{4})-(0[1-9]|1[0-2])-([12])$/;

/** The first day of the fortnight of the address, or null when it is not one. */
export const fortnightFromParam = (raw: unknown) => {
  const match = typeof raw === 'string' ? FORTNIGHT_PARAM.exec(raw) : null;
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3] === '1' ? '01' : '16'}`;
};

/** The two days of a period, both included. */
export const periodBounds = (period: PayrollPeriod) =>
  period.kind === 'fortnight'
    ? { from: period.start, to: fortnightEnd(period.start) }
    : { from: period.from, to: period.to };

/** «Mes comercial» unless the admin chose «Días reales» (CA-13). */
export const effectiveMethod = (query: PayrollQuery): PayrollMethod =>
  query.method ?? DEFAULT_PAYROLL_METHOD;

const MONTH_YEAR = new Intl.DateTimeFormat('es-CO', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY_MONTH = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const FULL = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' });

/** «noviembre de 2026»: the month of a fortnight, to name it (CA-01). */
export const monthYear = (start: string) => MONTH_YEAR.format(utc(start));

/**
 * The two ends of a range, saying only what is needed: «3» to «20 de noviembre de 2026»; «25 de
 * noviembre» to «5 de diciembre de 2026»; with both years when they differ (CA-06).
 */
export const rangeEnds = (from: string, to: string) => {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const sameMonth = sameYear && from.slice(5, 7) === to.slice(5, 7);
  const first = sameMonth
    ? String(Number(from.slice(8)))
    : sameYear
      ? DAY_MONTH.format(utc(from))
      : FULL.format(utc(from));
  return { from: first, to: FULL.format(utc(to)) };
};

/** The query of an address: the period always, the method only when chosen (CA-10, CA-13). */
const params = ({ period, method }: PayrollQuery) => {
  const search = new URLSearchParams(
    period.kind === 'fortnight'
      ? { fortnight: fortnightParam(period.start) }
      : { from: period.from, to: period.to }
  );
  if (method) search.set('base', method);
  return search;
};

export const payrollHref = (query: PayrollQuery) => `${PAYROLL_PATH}?${params(query)}`;
export const payrollEmployeeHref = (query: PayrollQuery, employeeId: string) =>
  `${PAYROLL_PATH}/${employeeId}?${params(query)}`;
export const payrollExportHref = (query: PayrollQuery) => `${PAYROLL_PATH}/export?${params(query)}`;
