/**
 * payroll-month.utils — which month the payroll shows and the addresses around it (spec 016,
 * HU-02).
 *
 * Guards:
 * - CA-05: it opens on the month in progress; another month is chosen in the address
 *   (`?month=2026-10`), which survives a reload and can be shared. A month that does not exist,
 *   or one still to come, is the month in progress.
 * - CA-05: «Mes anterior» always exists; «Mes siguiente» stops at the month in progress (a month
 *   to come has nothing to pay yet).
 * - Its name as read in Colombia: «Noviembre de 2026».
 * - The addresses of the payroll, of an employee's detail and of its Excel carry the same month.
 */
import {
  monthLabel,
  monthStart,
  nextMonth,
  parsePayrollMonth,
  payrollEmployeeHref,
  payrollExportHref,
  payrollHref,
  previousMonth,
} from '@web/modules/reports/utils/payroll-month.utils';

/** «Today» in Bogotá for these tests: 23 November 2026. */
const TODAY = '2026-11-23';

describe('parsePayrollMonth', () => {
  it('opens on the month in progress (CA-05)', () => {
    expect(parsePayrollMonth(undefined, TODAY)).toBe('2026-11');
  });

  it('keeps a past month of the address (CA-05)', () => {
    expect(parsePayrollMonth('2026-10', TODAY)).toBe('2026-10');
    expect(parsePayrollMonth('2025-01', TODAY)).toBe('2025-01');
  });

  it.each([
    ['a month to come', '2026-12'],
    ['a month that does not exist', '2026-13'],
    ['another format', '11/2026'],
    ['a whole day', '2026-10-05'],
    ['nothing', ''],
  ])('reads %s as the month in progress (CA-05)', (_, raw) => {
    expect(parsePayrollMonth(raw, TODAY)).toBe('2026-11');
  });

  it('takes the first value when the address repeats it', () => {
    expect(parsePayrollMonth(['2026-09', '2026-10'], TODAY)).toBe('2026-09');
  });
});

describe('previousMonth and nextMonth', () => {
  it('goes back one month, also across the year (CA-05)', () => {
    expect(previousMonth('2026-11')).toBe('2026-10');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('goes forward one month, also across the year (CA-05)', () => {
    expect(nextMonth('2025-12', TODAY)).toBe('2026-01');
  });

  it('has no next month after the month in progress (CA-05)', () => {
    expect(nextMonth('2026-11', TODAY)).toBeNull();
    expect(nextMonth('2026-10', TODAY)).toBe('2026-11');
  });
});

describe('monthStart and monthLabel', () => {
  it('names the month for the database by its first day', () => {
    expect(monthStart('2026-02')).toBe('2026-02-01');
  });

  it('names the month as read in Colombia, capitalised', () => {
    expect(monthLabel('2026-11')).toBe('Noviembre de 2026');
    expect(monthLabel('2027-01')).toBe('Enero de 2027');
  });
});

describe('payroll addresses', () => {
  it('carry the month: the payroll, an employee and the Excel (CA-05, CA-11, CA-18)', () => {
    expect(payrollHref('2026-10')).toBe('/reports/payroll?month=2026-10');
    expect(payrollEmployeeHref('2026-10', 'e1')).toBe('/reports/payroll/e1?month=2026-10');
    expect(payrollExportHref('2026-10')).toBe('/reports/payroll/export?month=2026-10');
  });
});
