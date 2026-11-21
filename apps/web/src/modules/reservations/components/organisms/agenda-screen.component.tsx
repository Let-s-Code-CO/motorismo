'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button, Chip } from '@heroui/react';
import { CalendarCog, Plus } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import { formatMobile } from '@web/modules/core/utils/phone.utils';
import ReservationStatusChip from '@web/modules/reservations/components/atoms/reservation-status-chip.component';
import DayNav from '@web/modules/reservations/components/molecules/day-nav.component';
import ReservationRow, {
  useReservationVehicle,
} from '@web/modules/reservations/components/molecules/reservation-row.component';
import type {
  AgendaDay,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';
import { weekStartOf } from '@web/modules/reservations/utils/agenda-date.utils';

type AgendaScreenProps = { day: AgendaDay; today: string; isAdmin: boolean };

const LIST =
  'flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small';
/** The seats of a slot: two per row on a phone, up to four on a wide screen; more wrap below. */
const SEATS = 'grid min-w-0 flex-1 grid-cols-2 gap-2 lg:grid-cols-4';

/** Pending and attended reservations take a seat; cancelled ones and no-shows do not (RN-02). */
const takesSeat = (reservation: ReservationSummary) =>
  reservation.status === 'pending' || reservation.status === 'attended';

/** A taken seat: who, their phone, which vehicle, the services and the state; it opens the reservation. */
const SeatCard = ({ reservation }: { reservation: ReservationSummary }) => {
  const t = useTranslations('reservations');
  const vehicleOf = useReservationVehicle();
  const services = reservation.services ?? [];

  return (
    <Link
      href={`/agenda/${reservation.id}`}
      className="flex min-h-24 min-w-0 flex-col gap-1 rounded-medium border border-divider bg-content1 p-3 shadow-small outline-none hover:border-default-300 focus-visible:ring-2 focus-visible:ring-focus"
    >
      <span className="truncate text-sm font-medium">{reservation.customer_name}</span>
      {reservation.customer_phone && (
        <span className="truncate text-xs text-default-500">
          {formatMobile(reservation.customer_phone)}
        </span>
      )}
      <span className="truncate text-xs text-default-500">{vehicleOf(reservation)}</span>
      <span className="truncate text-xs text-default-500">
        {services.length ? services.join(' · ') : t('row.noServices')}
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-1 pt-1">
        {reservation.status && <ReservationStatusChip status={reservation.status} />}
        {reservation.out_of_hours && (
          <Chip size="sm" variant="flat" color="warning">
            {t('flags.outOfHours')}
          </Chip>
        )}
        {reservation.over_capacity && (
          <Chip size="sm" variant="flat" color="warning">
            {t('flags.overCapacity')}
          </Chip>
        )}
      </span>
    </Link>
  );
};

/**
 * «Agenda» (spec 012, HU-02) as a board of seats: each slot is a row with its time and how many seats
 * are free («1 de 2 libres», «Llena», «Ya empezó»), and one box per seat, taken by a reservation or
 * free to book (CA-09); cancelled ones and no-shows are listed apart, since they take no seat. Another
 * day is one tap away (CA-10). A closed day or a week not enabled says so (CA-03); reservations that
 * no longer fit the hours are listed apart, flagged (CA-31).
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
  const booked = day.reservations.filter(takesSeat).length;
  const freeSeats = day.slots
    .filter((slot) => !slot.started)
    .reduce((sum, slot) => sum + Math.max(0, slot.seats - slot.taken), 0);

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

      {day.state === 'open' && (
        <p aria-live="polite" className="text-sm font-medium text-default-600">
          {t('day.summary', { reservations: booked, free: freeSeats })}
        </p>
      )}

      {day.slots.length > 0 && (
        <ol aria-label={t('day.slotsLabel')} className="flex flex-col divide-y divide-divider">
          {day.slots.map((slot) => {
            const free = Math.max(0, slot.seats - slot.taken);
            const inSlot = day.reservations.filter((r) => r.slot_start === slot.slot_start);
            const seated = inSlot.filter(takesSeat);
            const inactive = inSlot.filter((r) => !takesSeat(r));
            const title = range(slot.slot_start, slot.slot_end);
            const status = slot.started
              ? t('day.started')
              : free === 0
                ? t('day.full')
                : t('day.seats', { free, seats: slot.seats });
            const bookHref = `/agenda/new?date=${day.date}&start=${encodeURIComponent(slot.slot_start)}`;

            return (
              <li
                key={slot.slot_start}
                aria-label={title}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:gap-6"
              >
                <div className="flex items-baseline justify-between gap-3 sm:w-52 sm:shrink-0 sm:flex-col sm:justify-start sm:gap-1">
                  <h2 className="font-semibold tracking-tight">{title}</h2>
                  <span className="text-xs text-default-500">{status}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <ul aria-label={t('day.seatsLabel', { range: title })} className={SEATS}>
                    {seated.map((reservation) => (
                      <li key={reservation.id} className="min-w-0">
                        <SeatCard reservation={reservation} />
                      </li>
                    ))}
                    {Array.from({ length: free }, (_, index) => (
                      <li key={`free-${index}`} className="min-w-0">
                        {slot.started ? (
                          <span className="flex min-h-24 items-center justify-center rounded-medium border border-dashed border-default-300 text-sm text-default-500">
                            {t('day.free')}
                          </span>
                        ) : (
                          <Link
                            href={bookHref}
                            className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-medium border border-dashed border-default-300 text-sm text-default-600 outline-none hover:border-default-500 hover:bg-default-50 focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            <Plus aria-hidden className="size-4" />
                            {/* WCAG 2.5.3: the slot for screen readers goes before the visible text. */}
                            <span>
                              <span className="sr-only">{title}: </span>
                              {t('day.book')}
                            </span>
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                  {inactive.length > 0 && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-default-500">
                      <span>{t('day.inactive')}</span>
                      {inactive.map((reservation) => (
                        <Link
                          key={reservation.id}
                          href={`/agenda/${reservation.id}`}
                          className="underline underline-offset-4 hover:text-foreground"
                        >
                          {reservation.customer_name} ·{' '}
                          {t(`status.${reservation.status ?? 'cancelled'}`)}
                        </Link>
                      ))}
                    </p>
                  )}
                </div>
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
