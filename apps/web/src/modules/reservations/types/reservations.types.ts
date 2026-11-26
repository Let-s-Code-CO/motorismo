import type { Database, Enums, Tables } from '@motorismo/supabase/types';

export type ReservationStatus = Enums<'reservation_status'>;

/**
 * A row of the summary view: who, which vehicle, which services, its tolerance and flags. Spec 024:
 * `service_minutes` goes with `service_ids`, one per service, null unless it is «a convenir» (the
 * generator types its elements as never null).
 */
export type ReservationSummary = Omit<Tables<'reservation_summaries'>, 'service_minutes'> & {
  service_minutes: (number | null)[] | null;
};

/** A slot of a day with its seats (spec 012, CA-03), as `agenda_slots` returns it. */
export type AgendaSlot = Database['public']['Functions']['agenda_slots']['Returns'][number];

/** Whether a day can be booked: an open day of an enabled week, closed, or a week not enabled. */
export type AgendaDayState = 'open' | 'closed' | 'unenabled';

/** One day of the agenda: its state, its slots and its reservations (HU-02). */
export type AgendaDay = {
  date: string;
  state: AgendaDayState;
  slots: AgendaSlot[];
  reservations: ReservationSummary[];
};

/** A day of a week of «Horario» (HU-05), hours as `HH:MM`. */
export type AgendaWeekDay = { is_open: boolean; opens_at: string; closes_at: string };

/** A week of «Horario»: its seven days (Monday first) and whether it is enabled. */
export type AgendaWeek = {
  week_start: string;
  enabled: boolean;
  /** False when the admin never saved it: the days are the proposal (RN-10). */
  saved: boolean;
  days: AgendaWeekDay[];
};

/** Each «+5 min» given to a customer on their way (spec 012, CA-38). */
export type ReservationExtension = Tables<'reservation_extension_summaries'>;

export type AgendaSettings = Pick<
  Tables<'agenda_settings'>,
  'slot_minutes' | 'seats' | 'tolerance_minutes'
>;
