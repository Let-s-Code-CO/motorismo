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
