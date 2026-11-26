import type { Database, Tables } from '@motorismo/supabase/types';

import type { WithNulls } from '@web/modules/core/types/with-nulls.types';

type Functions = Database['public']['Functions'];

/** An employee of a service and their share of it, as `service_report` gives them. */
export type ReportEmployeeShare = { name: string; share: number };

/**
 * One service done in a closed order (spec 015, CA-01), as `service_report` returns it: the
 * vehicle may have no line and no plate (a bicycle).
 */
export type ServiceReportRow = Omit<
  WithNulls<Functions['service_report']['Returns'][number], 'line_name' | 'plate'>,
  'employees'
> & { employees: ReportEmployeeShare[] };

/**
 * How many services and their sum; the discounts and the total are null with an employee filter
 * (CA-06, RN-03).
 */
export type ServiceReportTotals = WithNulls<
  Functions['service_report_totals']['Returns'][number],
  'discounts' | 'total'
>;

/** An employee to filter by, also a disabled one (CA-03). */
export type ReportEmployee = Pick<Tables<'employees'>, 'id' | 'full_name' | 'disabled_at'>;

/** The filters of the report, as the address says them (CA-05). Days are `YYYY-MM-DD`. */
export type ReportFilters = {
  from: string;
  to: string;
  employee: string | null;
  /** Upper case, letters and digits only, as the database compares it; '' for any vehicle. */
  plate: string;
  page: number;
};

/** The period the report opens on: this month, from day 1 to today (CA-01). */
export type ReportPeriod = Pick<ReportFilters, 'from' | 'to'>;

/** How the base salary is computed (spec 020, RN-02): «Mes comercial» or «Días reales». */
export type PayrollMethod = 'commercial' | 'actual';

/**
 * The period of the payroll (spec 020, RF-01): a fortnight by its first day (the 1st or the 16th) or
 * any two days, both included. Days are `YYYY-MM-DD`.
 */
export type PayrollPeriod =
  { kind: 'fortnight'; start: string } | { kind: 'range'; from: string; to: string };

/**
 * What the address asks for (CA-10, CA-13): a period and the method the admin chose, or null when
 * they chose none («Mes comercial», or a closed fortnight's own method, CA-16).
 */
export type PayrollQuery = { period: PayrollPeriod; method: PayrollMethod | null };

/** Provisional (a fortnight not closed), closed, or a query (a range, CA-08). */
export type PayrollStatus = 'provisional' | 'closed' | 'query';

/**
 * The state of a period's payroll (spec 020), as `payroll_period` returns it: who closed or
 * regenerated it and when, and the total before, only once it is closed; `method` is the one its
 * figures were computed with (a closed fortnight's own, CA-16).
 */
export type PayrollState = Omit<
  WithNulls<
    Functions['payroll_period']['Returns'][number],
    'closed_at' | 'closed_by_name' | 'regenerated_at' | 'regenerated_by_name' | 'previous_total'
  >,
  'status' | 'kind' | 'method'
> & { status: PayrollStatus; kind: PayrollPeriod['kind']; method: PayrollMethod };

/** An employee of a period's payroll (CA-01, CA-06). */
export type PayrollLine = Functions['payroll_lines']['Returns'][number];

/** A service an employee took part in, with its commission (CA-04). */
export type PayrollItem = Functions['payroll_items']['Returns'][number];

/** A piece of an employee's base salary: a fortnight, or part of one, of the period (CA-04, RN-02). */
export type PayrollBasePart = Functions['payroll_base_parts']['Returns'][number];
