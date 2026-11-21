'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@heroui/react';
import { CalendarCog, Plus } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import DayNav from '@web/modules/reservations/components/molecules/day-nav.component';
import ReservationRow from '@web/modules/reservations/components/molecules/reservation-row.component';
import type { AgendaDay } from '@web/modules/reservations/types/reservations.types';
import { weekStartOf } from '@web/modules/reservations/utils/agenda-date.utils';

type AgendaScreenProps = { day: AgendaDay; today: string; isAdmin: boolean };

const LIST =
  'flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small';

/**
 * «Agenda» (spec 012, HU-02): a day with its slots in order, each with its free seats and its
 * reservations (CA-09); another day is one tap away (CA-10). A closed day or a week not enabled says
 * so (CA-03); reservations that no longer fit the hours are listed apart, flagged (CA-31).
 */
const AgendaScreen = ({ day, today, isAdmin }: AgendaScreenProps) => {
  const t = useTranslations('reservations');
  const clock = useClock();
  const range = (start: string, end: string) =>
    t('day.slot', { start: clock(new Date(start)), end: clock(new Date(end)) });

  const slotStarts = new Set(day.slots.map((slot) => slot.slot_start));
  const apart = day.reservations.filter(
    (reservation) => !slotStarts.has(reservation.slot_start ?? '')
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-default-500">{t('description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Button
              as={Link}
              href={`/agenda/schedule?week=${weekStartOf(day.date)}`}
              variant="bordered"
              startContent={<CalendarCog aria-hidden className="size-4" />}
            >
              {t('schedule')}
            </Button>
          )}
          <Button
            as={Link}
            href={`/agenda/new?date=${day.date}`}
            color="primary"
            className="font-medium"
            startContent={<Plus aria-hidden className="size-4" />}
          >
            {t('new')}
          </Button>
        </div>
      </div>

      <DayNav date={day.date} today={today} basePath="/agenda" />

      {day.state !== 'open' && (
        <div className="rounded-large border border-dashed border-default-300 p-5 text-center">
          <p className="font-medium">
            {t(day.state === 'closed' ? 'day.closed' : 'day.unenabled')}
          </p>
          <p className="text-sm text-default-500">
            {t(day.state === 'closed' ? 'day.closedText' : 'day.unenabledText')}
          </p>
        </div>
      )}

      {day.state === 'open' && day.reservations.length === 0 && (
        <p className="text-sm text-default-500">{t('day.empty')}</p>
      )}

      {day.slots.length > 0 && (
        <ol aria-label={t('day.slotsLabel')} className="flex flex-col gap-4">
          {day.slots.map((slot) => {
            const free = Math.max(0, slot.seats - slot.taken);
            const reservations = day.reservations.filter((r) => r.slot_start === slot.slot_start);
            const title = range(slot.slot_start, slot.slot_end);
            const bookable = !slot.started && free > 0;

            return (
              <li key={slot.slot_start} aria-label={title} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold tracking-tight">{title}</h2>
                  <span className="flex items-center gap-3 text-sm text-default-500">
                    {slot.started
                      ? t('day.started')
                      : free === 0
                        ? t('day.full')
                        : t('day.seats', { free, seats: slot.seats })}
                    {bookable && (
                      <Link
                        href={`/agenda/new?date=${day.date}&start=${encodeURIComponent(slot.slot_start)}`}
                        className="cursor-pointer font-medium text-foreground underline underline-offset-4"
                      >
                        {/* WCAG 2.5.3: the extra for screen readers goes before the visible text. */}
                        <span className="sr-only">{title}: </span>
                        {t('day.book')}
                      </Link>
                    )}
                  </span>
                </div>
                {reservations.length > 0 && (
                  <ul className={LIST}>
                    {reservations.map((reservation) => (
                      <li key={reservation.id}>
                        <ReservationRow reservation={reservation} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {apart.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold tracking-tight">{t('day.outOfHoursTitle')}</h2>
          <ul aria-label={t('day.outOfHoursTitle')} className={LIST}>
            {apart.map((reservation) => (
              <li key={reservation.id}>
                <ReservationRow reservation={reservation} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default AgendaScreen;
