import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { REPORT_PAGE_SIZE } from '@web/modules/reports/constants/reports.constants';
import type {
  ReportEmployee,
  ReportFilters,
  ServiceReportRow,
  ServiceReportTotals,
} from '@web/modules/reports/types/reports.types';

const args = ({ from, to, employee, plate }: ReportFilters) => ({
  p_from: from,
  p_to: to,
  p_employee: employee ?? undefined,
  p_plate: plate || undefined,
});

/**
 * The services report (spec 015) for these filters, read with the admin's own session: the
 * database functions refuse anyone else (RN-04). The rows of the page (or, `all`, every row, for
 * the Excel, CA-12) and the totals of the whole filter (CA-11), from the same filtered set (RF-02).
 */
export const getServiceReport = async (
  filters: ReportFilters,
  { all = false }: { all?: boolean } = {}
): Promise<{ rows: ServiceReportRow[]; totals: ServiceReportTotals }> => {
  const supabase = await createSupabaseServerClient();
  const [rows, totals] = await Promise.all([
    supabase.rpc('service_report', {
      ...args(filters),
      ...(all
        ? {}
        : { p_limit: REPORT_PAGE_SIZE, p_offset: (filters.page - 1) * REPORT_PAGE_SIZE }),
    }),
    supabase.rpc('service_report_totals', args(filters)),
  ]);
  if (rows.error) throw new Error(`Could not read the service report: ${rows.error.message}`);
  if (totals.error) throw new Error(`Could not read the report totals: ${totals.error.message}`);

  const [sums] = totals.data;
  return {
    // `employees` is jsonb: [{ name, share }], ordered by share (the function builds it).
    rows: rows.data as ServiceReportRow[],
    totals: sums ?? { services: 0, subtotal: 0, discounts: 0, total: 0 },
  };
};

/** Every employee by name, also the disabled ones: they took part in past services (CA-03). */
export const listReportEmployees = async (): Promise<ReportEmployee[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, disabled_at')
    .order('full_name');
  if (error) throw new Error(`Could not list employees: ${error.message}`);
  return data;
};
