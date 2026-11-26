/**
 * payroll-period.utils — which period the payroll shows and the addresses around it (spec 020,
 * HU-01, HU-02).
 *
 * Guards:
 * - RF-01: a fortnight runs from the 1st to the 15th, or from the 16th to the last day of its month
 *   (28, 29, 30 or 31); any day names its fortnight.
 * - CA-01: «‹ Quincena anterior» always exists; «Quincena siguiente ›» stops at the fortnight in
 *   progress (one still to come has nothing to pay yet).
 * - Names as read in Colombia: «noviembre de 2026» for a fortnight's month; a range's two ends say
 *   only what is needed («3» to «20 de noviembre de 2026»).
 * - CA-10, CA-13: the addresses of the payroll, of an employee's detail and of its Excel carry the
 *   period, and the method only when the admin chose one (otherwise «Mes comercial», or for a closed
 *   fortnight its own: CA-16).
 */
import type { PayrollQuery } from '@web/modules/reports/types/reports.types';
import {
  effectiveMethod,
  fortnightEnd,
  fortnightFromParam,
  fortnightHalf,
  fortnightOf,
  fortnightParam,
  isFortnight,
  monthYear,
  nextFortnight,
  payrollEmployeeHref,
  payrollExportHref,
  payrollHref,
  periodBounds,
  previousFortnight,
  rangeEnds,
} from '@web/modules/reports/utils/payroll-period.utils';

/** «Today» in Bogotá for these tests: 23 November 2026 (second fortnight). */
const TODAY = '2026-11-23';

const fortnight = (start: string, method: PayrollQuery['method'] = null): PayrollQuery => ({
  period: { kind: 'fortnight', start },
  method,
});
const range = (from: string, to: string, method: PayrollQuery['method'] = null): PayrollQuery => ({
  period: { kind: 'range', from, to },
  method,
});

describe('fortnights (RF-01)', () => {
  it.each([
    ['2026-11-01', '2026-11-01'],
    ['2026-11-15', '2026-11-01'],
    ['2026-11-16', '2026-11-16'],
    ['2026-11-30', '2026-11-16'],
  ])('puts %s in the fortnight that starts on %s', (day, start) => {
    expect(fortnightOf(day)).toBe(start);
  });

  it.each([
    ['2026-11-01', '2026-11-15'],
    ['2026-11-16', '2026-11-30'],
    ['2026-12-16', '2026-12-31'],
    ['2026-02-16', '2026-02-28'],
    ['2028-02-16', '2028-02-29'],
  ])('ends the fortnight of %s on %s (the 15th, or the last day of its month)', (start, end) => {
    expect(fortnightEnd(start)).toBe(end);
  });

  it('says which half of its month a fortnight is', () => {
    expect(fortnightHalf('2026-11-01')).toBe(1);
    expect(fortnightHalf('2026-11-16')).toBe(2);
  });

  it('tells whether two dates are exactly a fortnight (spec 020, CA-08)', () => {
    expect(isFortnight('2026-11-01', '2026-11-15')).toBe(true);
    expect(isFortnight('2026-02-16', '2026-02-28')).toBe(true);
    expect(isFortnight('2026-11-01', '2026-11-14')).toBe(false);
    expect(isFortnight('2026-11-02', '2026-11-15')).toBe(false);
  });
});

describe('moving between fortnights (CA-01)', () => {
  it('goes back one fortnight, across months and years', () => {
    expect(previousFortnight('2026-11-16')).toBe('2026-11-01');
    expect(previousFortnight('2026-11-01')).toBe('2026-10-16');
    expect(previousFortnight('2026-01-01')).toBe('2025-12-16');
  });

  it('goes forward one fortnight, up to the one in progress and no further', () => {
    expect(nextFortnight('2026-10-16', TODAY)).toBe('2026-11-01');
    expect(nextFortnight('2026-11-01', TODAY)).toBe('2026-11-16');
    expect(nextFortnight('2026-11-16', TODAY)).toBeNull();
    expect(nextFortnight('2025-12-16', '2026-01-10')).toBe('2026-01-01');
  });
});

describe('the address of a fortnight (CA-10)', () => {
  it('writes a fortnight as its month and half: 2026-11-1, 2026-11-2', () => {
    expect(fortnightParam('2026-11-01')).toBe('2026-11-1');
    expect(fortnightParam('2026-11-16')).toBe('2026-11-2');
  });

  it('reads it back, and nothing that is not one', () => {
    expect(fortnightFromParam('2026-11-1')).toBe('2026-11-01');
    expect(fortnightFromParam('2026-11-2')).toBe('2026-11-16');
    expect(fortnightFromParam('2026-11-3')).toBeNull();
    expect(fortnightFromParam('2026-13-1')).toBeNull();
    expect(fortnightFromParam('2026-11')).toBeNull();
    expect(fortnightFromParam(undefined)).toBeNull();
  });
});

describe('periodBounds', () => {
  it('gives the two days of a fortnight or of a range, both included', () => {
    expect(periodBounds({ kind: 'fortnight', start: '2026-02-16' })).toEqual({
      from: '2026-02-16',
      to: '2026-02-28',
    });
    expect(periodBounds({ kind: 'range', from: '2026-11-03', to: '2026-11-20' })).toEqual({
      from: '2026-11-03',
      to: '2026-11-20',
    });
  });
});

describe('names (CA-01, CA-06)', () => {
  it('names the month of a fortnight: «noviembre de 2026»', () => {
    expect(monthYear('2026-11-16')).toBe('noviembre de 2026');
  });

  it.each([
    ['2026-11-03', '2026-11-20', '3', '20 de noviembre de 2026'],
    ['2026-11-25', '2026-12-05', '25 de noviembre', '5 de diciembre de 2026'],
    ['2026-12-28', '2027-01-03', '28 de diciembre de 2026', '3 de enero de 2027'],
  ])('says only what is needed of a range from %s to %s', (from, to, first, last) => {
    expect(rangeEnds(from, to)).toEqual({ from: first, to: last });
  });
});

describe('the method (CA-13)', () => {
  it('is «Mes comercial» unless the admin chose «Días reales»', () => {
    expect(effectiveMethod(fortnight('2026-11-16'))).toBe('commercial');
    expect(effectiveMethod(fortnight('2026-11-16', 'actual'))).toBe('actual');
  });
});

describe('addresses (CA-10, CA-13)', () => {
  it('writes the period always, and the method only when one was chosen', () => {
    expect(payrollHref(fortnight('2026-11-01'))).toBe('/reports/payroll?fortnight=2026-11-1');
    expect(payrollHref(fortnight('2026-11-16', 'actual'))).toBe(
      '/reports/payroll?fortnight=2026-11-2&base=actual'
    );
    // Chosen on purpose, even the default: on a fortnight closed in actual days it is a choice (CA-16).
    expect(payrollHref(fortnight('2026-11-16', 'commercial'))).toBe(
      '/reports/payroll?fortnight=2026-11-2&base=commercial'
    );
    expect(payrollHref(range('2026-11-03', '2026-11-20'))).toBe(
      '/reports/payroll?from=2026-11-03&to=2026-11-20'
    );
  });

  it('gives the detail of an employee and the Excel the same period and method', () => {
    expect(payrollEmployeeHref(range('2026-11-03', '2026-11-20', 'actual'), 'e-1')).toBe(
      '/reports/payroll/e-1?from=2026-11-03&to=2026-11-20&base=actual'
    );
    expect(payrollExportHref(fortnight('2026-11-01'))).toBe(
      '/reports/payroll/export?fortnight=2026-11-1'
    );
  });
});
