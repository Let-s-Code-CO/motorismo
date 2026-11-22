'use client';

import { useTranslations } from 'next-intl';

import { Input, Switch } from '@heroui/react';

import type { AgendaWeekDay } from '@web/modules/reservations/types/reservations.types';

type DayScheduleRowProps = {
  /** «Lunes 23 de noviembre». */
  title: string;
  day: AgendaWeekDay;
  onChange: (day: AgendaWeekDay) => void;
  errorMessage?: string;
};

/** One day of a week of «Horario» (spec 012, CA-27): open with its hours, or closed. */
const DayScheduleRow = ({ title, day, onChange, errorMessage }: DayScheduleRowProps) => {
  const t = useTranslations('reservations.scheduleScreen');

  return (
    <li
      aria-label={title}
      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 sm:w-64">
        <span className="font-medium first-letter:uppercase">{title}</span>
        <Switch
          size="sm"
          isSelected={day.is_open}
          onValueChange={(is_open) => onChange({ ...day, is_open })}
        >
          {/* WCAG 2.5.3: the day for screen readers goes before the visible text. */}
          <span className="sr-only">{title}: </span>
          {t('open')}
        </Switch>
      </div>
      {day.is_open && (
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <Input
            type="time"
            step={900}
            label={t('opensAt')}
            labelPlacement="outside"
            variant="bordered"
            value={day.opens_at}
            onValueChange={(opens_at) => onChange({ ...day, opens_at })}
          />
          <Input
            type="time"
            step={900}
            label={t('closesAt')}
            labelPlacement="outside"
            variant="bordered"
            value={day.closes_at}
            onValueChange={(closes_at) => onChange({ ...day, closes_at })}
            isInvalid={!!errorMessage}
            errorMessage={errorMessage}
          />
        </div>
      )}
    </li>
  );
};

export default DayScheduleRow;
