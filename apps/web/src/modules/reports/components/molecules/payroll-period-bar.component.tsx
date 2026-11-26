'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Radio, RadioGroup } from '@heroui/react';
import { ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';

import useUrlFilters from '@web/modules/core/hooks/url-filters.hook';
import DateRangeFields from '@web/modules/reports/components/molecules/date-range-fields.component';
import usePeriodName from '@web/modules/reports/hooks/payroll-period-name.hook';
import type { PayrollMethod, PayrollQuery } from '@web/modules/reports/types/reports.types';
import {
  isFortnight,
  nextFortnight,
  payrollHref,
  periodBounds,
  previousFortnight,
} from '@web/modules/reports/utils/payroll-period.utils';

type PayrollPeriodBarProps = {
  query: PayrollQuery;
  /** The first day of the fortnight in progress: «Quincena siguiente» stops there. */
  currentFortnight: string;
  /** The method in sight: the one chosen, or the one the figures were computed with (CA-16). */
  selectedMethod: PayrollMethod;
};

const METHODS: PayrollMethod[] = ['commercial', 'actual'];
const NAV_LINK =
  'inline-flex items-center gap-1 rounded-small text-sm text-default-600 underline-offset-4 hover:text-foreground hover:underline';

/**
 * The period of the payroll and how to change it (spec 020): a fortnight with the one before and
 * after (CA-01); a range, named, with the way back to the fortnight in progress (CA-08); «Desde» and
 * «Hasta» (CA-06; exactly a fortnight is that fortnight); and the method of the base salary (CA-13).
 * All of it lives in the address (CA-10): each change replaces it and the server draws it again.
 */
const PayrollPeriodBar = ({ query, currentFortnight, selectedMethod }: PayrollPeriodBarProps) => {
  const t = useTranslations('reports.payroll');
  const periodName = usePeriodName();
  // Several changes can be on their way at once: each builds on the newest asked for.
  const { navigate, latest } = useUrlFilters({
    filters: query,
    href: payrollHref,
    onOutside: () => undefined,
  });
  // The choice is seen at once, while the page with its figures is on its way; a new page from the
  // server (another period, «atrás») brings its own.
  const [chosen, setChosen] = useState({ for: selectedMethod, method: selectedMethod });
  const shownMethod = chosen.for === selectedMethod ? chosen.method : selectedMethod;
  const { period } = query;
  const next = period.kind === 'fortnight' ? nextFortnight(period.start, currentFortnight) : null;

  return (
    <div className="flex flex-col gap-4">
      {period.kind === 'fortnight' ? (
        // On a phone the name on top and its neighbours under it, one on each side; from `sm`, all
        // in a row («‹ Quincena anterior  2.ª quincena de octubre de 2026  Quincena siguiente ›»).
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-xl font-semibold tracking-tight sm:order-2">{periodName(period)}</h2>
          <div className="flex items-center justify-between sm:contents">
            <Link
              href={payrollHref({
                ...query,
                period: { kind: 'fortnight', start: previousFortnight(period.start) },
              })}
              className={`${NAV_LINK} sm:order-1`}
            >
              <ChevronLeft aria-hidden className="size-4" />
              {t('previousFortnight')}
            </Link>
            {next && (
              <Link
                href={payrollHref({ ...query, period: { kind: 'fortnight', start: next } })}
                className={`${NAV_LINK} sm:order-3`}
              >
                {t('nextFortnight')}
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-xl font-semibold tracking-tight">{periodName(period)}</h2>
          <Link
            href={payrollHref({ ...query, period: { kind: 'fortnight', start: currentFortnight } })}
            className={NAV_LINK}
          >
            <Undo2 aria-hidden className="size-4" />
            {t('backToCurrent')}
          </Link>
        </div>
      )}

      <div
        role="group"
        aria-label={t('periodLabel')}
        className="grid grid-cols-2 items-end gap-3 md:grid-cols-[repeat(2,minmax(0,10rem))_auto]"
      >
        <DateRangeFields
          value={periodBounds(period)}
          latest={() => periodBounds(latest().period)}
          onChange={({ from, to }) =>
            navigate({
              ...latest(),
              period: isFortnight(from, to)
                ? { kind: 'fortnight', start: from }
                : { kind: 'range', from, to },
            })
          }
        />
        <RadioGroup
          label={t('method')}
          orientation="horizontal"
          className="col-span-2 md:col-span-1 md:pl-3"
          classNames={{ label: 'text-sm text-foreground', wrapper: 'gap-x-5' }}
          value={shownMethod}
          onValueChange={(value) => {
            const method = value as PayrollMethod;
            setChosen({ for: selectedMethod, method });
            navigate({ ...latest(), method });
          }}
        >
          {METHODS.map((method) => (
            <Radio key={method} value={method} description={t(`methodHelp.${method}`)}>
              {t(`methods.${method}`)}
            </Radio>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
};

export default PayrollPeriodBar;
