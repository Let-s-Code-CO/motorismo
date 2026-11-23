import type { ReportFilters } from '@web/modules/reports/types/reports.types';

export const REPORT_PATH = '/reports/services';
export const EXPORT_PATH = '/reports/services/export';

/** The filters as an address query (CA-05). The period always: a copied link keeps its days. */
const filterParams = ({ from, to, employee, plate }: ReportFilters) => {
  const params = new URLSearchParams({ from, to });
  if (employee) params.set('employee', employee);
  if (plate) params.set('plate', plate);
  return params;
};

/** The report with these filters and page (page 1 is not written) (CA-05, CA-11). */
export const reportHref = (filters: ReportFilters) => {
  const params = filterParams(filters);
  if (filters.page > 1) params.set('page', String(filters.page));
  return `${REPORT_PATH}?${params}`;
};

/** The Excel of these filters: every row, so never a page (CA-12, RF-02). */
export const exportHref = (filters: ReportFilters) => `${EXPORT_PATH}?${filterParams(filters)}`;
