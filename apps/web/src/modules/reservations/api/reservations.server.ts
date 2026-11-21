import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { PROPOSED_DAY } from '@web/modules/reservations/constants/reservations.constants';
import type {
  AgendaDay,
  AgendaSettings,
  AgendaWeek,
  ReservationExtension,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';
import { weekDays } from '@web/modules/reservations/utils/agenda-date.utils';

/** `09:00:00` → `09:00`. */
const hhmm = (time: string) => time.slice(0, 5);

/**
 * One day of the agenda (spec 012, HU-02), read with the person's session (RLS: staff only): whether
 * it can be booked, its slots with their seats (CA-03) and its reservations in order (CA-09).
 */
export const getAgendaDay = async (date: string): Promise<AgendaDay> => {
  const supabase = await createSupabaseServerClient();
  const [day, slots, reservations] = await Promise.all([
    supabase
      .from('agenda_days')
      .select('is_open, agenda_weeks(enabled)')
      .eq('day', date)
      .maybeSingle(),
    supabase.rpc('agenda_slots', { p_day: date }),
    supabase
      .from('reservation_summaries')
      .select('*')
      .eq('day', date)
      .order('slot_start')
      .order('number'),
  ]);
  if (day.error) throw new Error(`Could not load the day: ${day.error.message}`);
  if (slots.error) throw new Error(`Could not load the slots: ${slots.error.message}`);
  if (reservations.error)
    throw new Error(`Could not load the reservations: ${reservations.error.message}`);

  const state =
    !day.data || !day.data.agenda_weeks?.enabled
      ? 'unenabled'
      : day.data.is_open
        ? 'open'
        : 'closed';
  return {
    date,
    state,
    slots: state === 'open' ? slots.data : [],
    reservations: reservations.data,
  };
};

/** A reservation with everything its detail shows (CA-11), or null if it does not exist. */
export const getReservation = async (id: string): Promise<ReservationSummary | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('reservation_summaries')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the reservation: ${error.message}`);
  return data;
};

/** The «+5 min» a reservation was given, oldest first, with who and when (CA-38). */
export const listReservationExtensions = async (id: string): Promise<ReservationExtension[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('reservation_extension_summaries')
    .select('*')
    .eq('reservation_id', id)
    .order('created_at');
  if (error) throw new Error(`Could not list the time given: ${error.message}`);
  return data;
};

/**
 * A week of «Horario» (HU-05): its seven days as saved, or the proposal of every day from 9:00 to
 * 18:00 if the admin never saved it (RN-10).
 */
export const getAgendaWeek = async (weekStart: string): Promise<AgendaWeek> => {
  const supabase = await createSupabaseServerClient();
  const [week, days] = await Promise.all([
    supabase.from('agenda_weeks').select('enabled').eq('week_start', weekStart).maybeSingle(),
    supabase
      .from('agenda_days')
      .select('day, is_open, opens_at, closes_at')
      .eq('week_start', weekStart),
  ]);
  if (week.error) throw new Error(`Could not load the week: ${week.error.message}`);
  if (days.error) throw new Error(`Could not load the days: ${days.error.message}`);

  return {
    week_start: weekStart,
    enabled: week.data?.enabled ?? false,
    saved: !!week.data,
    days: weekDays(weekStart).map((day) => {
      const saved = days.data.find((row) => row.day === day);
      return saved
        ? {
            is_open: saved.is_open,
            opens_at: hhmm(saved.opens_at),
            closes_at: hhmm(saved.closes_at),
          }
        : PROPOSED_DAY;
    }),
  };
};

/** The agenda settings of the business (CA-29). */
export const getAgendaSettings = async (): Promise<AgendaSettings> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('agenda_settings')
    .select('slot_minutes, seats, tolerance_minutes')
    .single();
  if (error) throw new Error(`Could not load the agenda settings: ${error.message}`);
  return data;
};

/**
 * The reservations whose time has come but whose customer has not arrived yet, within their
 * tolerance (CA-18): the queue shows them in their place.
 */
export const listArrivingReservations = async (
  now: Date = new Date()
): Promise<ReservationSummary[]> => {
  const supabase = await createSupabaseServerClient();
  const instant = now.toISOString();
  const { data, error } = await supabase
    .from('reservation_summaries')
    .select('*')
    .eq('status', 'pending')
    .lte('slot_start', instant)
    .gte('grace_until', instant)
    .order('slot_start');
  if (error) throw new Error(`Could not list the arriving reservations: ${error.message}`);
  return data;
};
