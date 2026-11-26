import { z } from 'zod';

import type {
  PayrollQuery,
  ReportFilters,
  ReportPeriod,
} from '@web/modules/reports/types/reports.types';
import {
  fortnightFromParam,
  fortnightOf,
  isFortnight,
} from '@web/modules/reports/utils/payroll-period.utils';
import { isAgendaDate } from '@web/modules/reservations/utils/agenda-date.utils';

/** A plate as the database compares it (CA-04): «uih-03d» → «UIH03D». */
export const reportPlate = (raw: string) =>
  raw
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, MAX_PLATE_LENGTH);

const MAX_PLATE_LENGTH = 10;

/** This month, from day 1 to today (CA-01); `today` is a day of Colombia. */
export const defaultPeriod = (today: string): ReportPeriod => ({
  from: `${today.slice(0, 8)}01`,
  to: today,
});

/** A repeated parameter (`?plate=a&plate=b`) counts once: the first. */
const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const param = <T extends z.ZodType>(schema: T) => z.preprocess(first, schema);

/**
 * The filters of the services report, read from the address (spec 015, CA-05). Nothing there can
 * break the report: what is wrong falls back to what the admin sees on opening it (CA-01, CA-02):
 * this month; an employee by id or none (CA-03); the plate normalized (CA-04); page 1 (CA-11).
 */
export const reportFiltersSchema = (today: string) =>
  z
    .object({
      from: param(z.string().refine(isAgendaDate).optional().catch(undefined)),
      to: param(z.string().refine(isAgendaDate).optional().catch(undefined)),
      // z.guid: any id written as a UUID (the database's own check is the real one).
      employee: param(z.guid().optional().catch(undefined)),
      plate: param(z.string().optional().catch(undefined)),
      page: param(z.coerce.number().int().min(1).optional().catch(undefined)),
    })
    .transform(({ from, to, employee, plate, page }): ReportFilters => {
      // Both ends or neither: half a range, or one upside down, is this month (CA-02).
      const period = from && to && from <= to ? { from, to } : defaultPeriod(today);
      return {
        ...period,
        employee: employee ?? null,
        plate: reportPlate(plate ?? ''),
        page: page ?? 1,
      };
    });

/**
 * The period and method of the payroll, read from the address (spec 020, CA-10). Like the services
 * report, nothing there can break it: what is wrong is the fortnight in progress (CA-09).
 * - A range, both days in order (CA-06); exactly a fortnight, that fortnight (CA-08).
 * - Otherwise a fortnight `2026-11-1` / `2026-11-2`, not one still to come (CA-01).
 * - The method only when the address says one of the two (CA-13); null means «not chosen».
 */
export const payrollQuerySchema = (today: string) =>
  z
    .object({
      from: param(z.string().refine(isAgendaDate).optional().catch(undefined)),
      to: param(z.string().refine(isAgendaDate).optional().catch(undefined)),
      fortnight: param(z.string().optional().catch(undefined)),
      base: param(z.enum(['commercial', 'actual']).optional().catch(undefined)),
    })
    .transform(({ from, to, fortnight, base }): PayrollQuery => {
      const current = fortnightOf(today);
      const asked = fortnightFromParam(fortnight);
      const period: PayrollQuery['period'] =
        from && to && from <= to
          ? isFortnight(from, to)
            ? { kind: 'fortnight', start: from }
            : { kind: 'range', from, to }
          : { kind: 'fortnight', start: asked && asked <= current ? asked : current };
      return { period, method: base ?? null };
    });
