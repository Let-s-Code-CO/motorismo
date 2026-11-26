import { useTranslations } from 'next-intl';

import type { PayrollPeriod } from '@web/modules/reports/types/reports.types';
import {
  fortnightHalf,
  monthYear,
  rangeEnds,
} from '@web/modules/reports/utils/payroll-period.utils';

/** A translator of `reports.payroll` that knows how to name a period. */
type PeriodTranslator = (key: 'fortnight' | 'range', values: Record<string, string>) => string;

/**
 * The name of a payroll period (spec 020): «2.ª quincena de octubre de 2026» or «Del 3 al 20 de
 * noviembre de 2026» (CA-01, CA-06). Pure, for the Excel route; `usePeriodName` for components.
 */
export const periodName = (t: PeriodTranslator, period: PayrollPeriod) =>
  period.kind === 'fortnight'
    ? t('fortnight', { half: String(fortnightHalf(period.start)), month: monthYear(period.start) })
    : t('range', rangeEnds(period.from, period.to));

const usePeriodName = () => {
  const t = useTranslations('reports.payroll');
  return (period: PayrollPeriod) => periodName(t, period);
};

export default usePeriodName;
