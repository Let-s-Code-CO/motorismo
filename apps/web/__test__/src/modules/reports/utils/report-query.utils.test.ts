/**
 * report-query.utils — the addresses of the services report: the report itself, each of its pages
 * and its Excel download, all from the same filters (spec 015, RF-02).
 *
 * Guards:
 * - CA-05: the filters live in the address, so reloading, «back» or a copied link open the same
 *   report. The period is always written, even when it is this month's: a link copied today still
 *   opens the same days next month.
 * - CA-11: a page is the same address with its page (page 1 is not written).
 * - CA-12: the download takes the same filters, never the page (it brings every row).
 * - Round trip: what the address says is read back exactly by `reportFiltersSchema`.
 */
import { reportFiltersSchema } from '@web/modules/reports/schemas/reports.schema';
import type { ReportFilters } from '@web/modules/reports/types/reports.types';
import { exportHref, reportHref } from '@web/modules/reports/utils/report-query.utils';

const EMPLOYEE = '6f1d2c3b-4a59-4e8f-9b0a-1c2d3e4f5a6b';

const filters = (overrides: Partial<ReportFilters> = {}): ReportFilters => ({
  from: '2026-11-01',
  to: '2026-11-23',
  employee: null,
  plate: '',
  page: 1,
  ...overrides,
});

/** What the page reads from an address. */
const readBack = (href: string) =>
  reportFiltersSchema('2026-11-23').parse(
    Object.fromEntries(new URL(href, 'http://localhost').searchParams)
  );

describe('reportHref', () => {
  it('always writes the period, even this month’s, so a copied link keeps its days (CA-05)', () => {
    expect(reportHref(filters())).toBe('/reports/services?from=2026-11-01&to=2026-11-23');
  });

  it('adds the employee and the plate when there are (CA-05)', () => {
    expect(reportHref(filters({ employee: EMPLOYEE, plate: 'UIH03D' }))).toBe(
      `/reports/services?from=2026-11-01&to=2026-11-23&employee=${EMPLOYEE}&plate=UIH03D`
    );
  });

  it('writes a page from page 2 on; page 1 is the report itself (CA-11)', () => {
    expect(reportHref(filters({ page: 2 }))).toBe(
      '/reports/services?from=2026-11-01&to=2026-11-23&page=2'
    );
    expect(reportHref(filters({ page: 1 }))).not.toContain('page=');
  });

  it.each([
    ['this month', filters()],
    ['every filter and a page', filters({ employee: EMPLOYEE, plate: 'KDM482', page: 3 })],
    ['another period', filters({ from: '2026-01-15', to: '2026-02-28' })],
  ])('is read back without losing anything: %s (CA-05)', (_, state) => {
    expect(readBack(reportHref(state))).toEqual(state);
  });
});

describe('exportHref', () => {
  it('downloads with the same filters, never the page: it brings every row (CA-12)', () => {
    expect(exportHref(filters({ employee: EMPLOYEE, plate: 'UIH03D', page: 4 }))).toBe(
      `/reports/services/export?from=2026-11-01&to=2026-11-23&employee=${EMPLOYEE}&plate=UIH03D`
    );
  });

  it('is read back as the same filters, on page 1 (RF-02)', () => {
    const state = filters({ employee: EMPLOYEE, plate: 'UIH03D', page: 4 });

    expect(readBack(exportHref(state))).toEqual({ ...state, page: 1 });
  });
});
