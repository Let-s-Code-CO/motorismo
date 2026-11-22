'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Input } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { addDays, isAgendaDate } from '@web/modules/reservations/utils/agenda-date.utils';

type DayNavProps = { date: string; today: string; basePath: string };

/**
 * The day's name as a calendar shows it, in Colombia: «miércoles, 12 de junio de 2030» (`long`) or
 * «miércoles, 12 de junio» (`short`, for the days of a week).
 */
export const useDayTitle = (style: 'long' | 'short' = 'long') => {
  const format = useFormatter();
  return (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00-05:00`), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(style === 'long' ? { year: 'numeric' } : {}),
    });
};

/**
 * Moves the agenda one day back or forth, back to «Hoy», or to any date (spec 012, CA-10). The day
 * lives in the URL (`?date=`), so it survives a reload and the back button.
 */
const DayNav = ({ date, today, basePath }: DayNavProps) => {
  const t = useTranslations('reservations.day');
  const router = useRouter();
  const dayTitle = useDayTitle();
  const hrefOf = (day: string) => `${basePath}?date=${day}`;

  return (
    <nav aria-label={t('label')} className="flex flex-wrap items-center gap-2">
      <Button
        as={Link}
        href={hrefOf(addDays(date, -1))}
        isIconOnly
        variant="bordered"
        aria-label={t('previous')}
      >
        <ChevronLeft aria-hidden className="size-4" />
      </Button>
      <Button as={Link} href={hrefOf(today)} variant="bordered" isDisabled={date === today}>
        {t('today')}
      </Button>
      <Button
        as={Link}
        href={hrefOf(addDays(date, 1))}
        isIconOnly
        variant="bordered"
        aria-label={t('next')}
      >
        <ChevronRight aria-hidden className="size-4" />
      </Button>
      <p aria-live="polite" className="min-w-0 flex-1 font-medium first-letter:uppercase">
        {dayTitle(date)}
      </p>
      <Input
        type="date"
        aria-label={t('pick')}
        variant="bordered"
        className="w-full sm:w-44"
        value={date}
        onValueChange={(value) => isAgendaDate(value) && router.push(hrefOf(value))}
      />
    </nav>
  );
};

export default DayNav;
