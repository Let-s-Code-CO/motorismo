'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@heroui/react';

type Range = { from: string; to: string };

type DateRangeFieldsProps = {
  /** The period drawn now. Days are `YYYY-MM-DD`. */
  value: Range;
  /**
   * The newest period asked for (`useUrlFilters().latest`), which may still be on its way: a change
   * builds on it, so none undoes another. The drawn one by default.
   */
  latest?: () => Range;
  onChange: (range: Range) => void;
  className?: string;
};

/**
 * «Desde» and «Hasta» (spec 015, CA-02; spec 020, CA-06): the period is never upside down, the other
 * end moves with the one chosen. A field emptied changes nothing.
 */
const DateRangeFields = ({
  value,
  latest = () => value,
  onChange,
  className,
}: DateRangeFieldsProps) => {
  const t = useTranslations('reports.filters');

  const changeFrom = (from: string) => {
    if (!from) return;
    const { to } = latest();
    onChange({ from, to: from > to ? from : to });
  };
  const changeTo = (to: string) => {
    if (!to) return;
    const { from } = latest();
    onChange({ from: to < from ? to : from, to });
  };

  return (
    <>
      <Input
        type="date"
        label={t('from')}
        labelPlacement="outside"
        placeholder=" "
        variant="bordered"
        className={className}
        value={value.from}
        onChange={(event) => changeFrom(event.target.value)}
      />
      <Input
        type="date"
        label={t('to')}
        labelPlacement="outside"
        placeholder=" "
        variant="bordered"
        className={className}
        value={value.to}
        onChange={(event) => changeTo(event.target.value)}
      />
    </>
  );
};

export default DateRangeFields;
