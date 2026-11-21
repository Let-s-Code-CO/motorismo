/**
 * The agenda's forms, checked before anything is sent (spec 012): the reservation, the week of
 * «Horario» and the agenda settings. The Server Actions parse the same values again, and the
 * database checks every rule a third time.
 *
 * Guards:
 * - reservationSchema (HU-01): a customer and a slot are required; vehicle, services and notes
 *   (up to 500 characters) are optional (CA-01, CA-04).
 * - agendaWeekSchema (HU-05): seven days, Monday first; an open day closes after it opens and
 *   holds at least one full slot of the current length, reported next to that day (CA-30); a
 *   closed day needs no hours.
 * - agendaSettingsSchema (CA-29): slots of 15 to 240 minutes in steps of 15, 1 to 20 seats and 0
 *   to 60 minutes of tolerance, typed as text or already numbers.
 */
import {
  agendaSettingsSchema,
  agendaWeekSchema,
  reservationSchema,
} from '@web/modules/reservations/schemas/reservations.schema';

const CUSTOMER = '6f9c8d1e-2b3a-4c5d-8e7f-0a1b2c3d4e5f';
const VEHICLE = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const SERVICE = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';

const issuesOf = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) =>
  result.success
    ? {}
    : Object.fromEntries(
        result.error!.issues.map((issue) => [issue.path.join('.'), issue.message])
      );

describe('reservationSchema', () => {
  const input = (overrides: Record<string, unknown> = {}) => ({
    customer_id: CUSTOMER,
    vehicle_id: VEHICLE,
    slot_start: '2030-06-12T09:00:00-05:00',
    service_ids: [SERVICE],
    notes: '  Pidió por WhatsApp ',
    ...overrides,
  });

  it('keeps the reservation, with the notes trimmed', () => {
    expect(reservationSchema.parse(input())).toEqual({
      customer_id: CUSTOMER,
      vehicle_id: VEHICLE,
      slot_start: '2030-06-12T09:00:00-05:00',
      service_ids: [SERVICE],
      notes: 'Pidió por WhatsApp',
    });
  });

  it('needs no vehicle, services or notes (CA-01, CA-04)', () => {
    expect(
      reservationSchema.parse(input({ vehicle_id: null, service_ids: undefined, notes: '' }))
    ).toEqual({
      customer_id: CUSTOMER,
      vehicle_id: null,
      slot_start: '2030-06-12T09:00:00-05:00',
      service_ids: [],
      notes: null,
    });
  });

  it('asks for the customer and the slot, next to each field', () => {
    expect(
      issuesOf(reservationSchema.safeParse(input({ customer_id: '', slot_start: '' })))
    ).toEqual({
      customer_id: 'customerRequired',
      slot_start: 'slotRequired',
    });
  });

  it('refuses notes over 500 characters (501)', () => {
    expect(issuesOf(reservationSchema.safeParse(input({ notes: 'a'.repeat(501) })))).toEqual({
      notes: 'notesTooLong',
    });
    expect(reservationSchema.safeParse(input({ notes: 'a'.repeat(500) })).success).toBe(true);
  });
});

describe('agendaWeekSchema', () => {
  const day = (overrides: Record<string, unknown> = {}) => ({
    is_open: true,
    opens_at: '09:00',
    closes_at: '18:00',
    ...overrides,
  });
  const week = (days = Array.from({ length: 7 }, () => day())) => ({
    week_start: '2030-06-10',
    enabled: true,
    days,
  });

  it('accepts the proposal: seven days from 9:00 to 18:00 (RN-10)', () => {
    expect(agendaWeekSchema(60).safeParse(week()).success).toBe(true);
  });

  it('refuses an open day that closes when it opens, next to that day (CA-30)', () => {
    const days = Array.from({ length: 7 }, () => day());
    days[1] = day({ closes_at: '09:00' });
    expect(issuesOf(agendaWeekSchema(60).safeParse(week(days)))).toEqual({
      'days.1.closes_at': 'dayInvalid',
    });
  });

  it('refuses an open day too short for one full slot: 9:00 to 9:30 with slots of 60 (CA-30)', () => {
    const days = Array.from({ length: 7 }, () => day());
    days[2] = day({ closes_at: '09:30' });
    expect(issuesOf(agendaWeekSchema(60).safeParse(week(days)))).toEqual({
      'days.2.closes_at': 'dayInvalid',
    });
    // With slots of 30 minutes, the same day holds exactly one.
    expect(agendaWeekSchema(30).safeParse(week(days)).success).toBe(true);
  });

  it('lets a closed day keep any hours (CA-27)', () => {
    const days = Array.from({ length: 7 }, () => day());
    days[6] = day({ is_open: false, closes_at: '09:00' });
    expect(agendaWeekSchema(60).safeParse(week(days)).success).toBe(true);
  });

  it('needs exactly seven days', () => {
    expect(agendaWeekSchema(60).safeParse(week([day()])).success).toBe(false);
  });
});

describe('agendaSettingsSchema', () => {
  it('turns typed values into numbers', () => {
    expect(
      agendaSettingsSchema.parse({ slot_minutes: '30', seats: '3', tolerance_minutes: '10' })
    ).toEqual({ slot_minutes: 30, seats: 3, tolerance_minutes: 10 });
  });

  it('accepts the limits: 15 and 240 minutes, 1 and 20 seats, 0 and 60 of tolerance (CA-29)', () => {
    expect(
      agendaSettingsSchema.safeParse({ slot_minutes: 15, seats: 1, tolerance_minutes: 0 }).success
    ).toBe(true);
    expect(
      agendaSettingsSchema.safeParse({ slot_minutes: 240, seats: 20, tolerance_minutes: 60 })
        .success
    ).toBe(true);
  });

  it('reports each value out of range next to its field (CA-29)', () => {
    expect(
      issuesOf(
        agendaSettingsSchema.safeParse({ slot_minutes: 50, seats: 0, tolerance_minutes: 61 })
      )
    ).toEqual({
      slot_minutes: 'slotMinutesRange',
      seats: 'seatsRange',
      tolerance_minutes: 'toleranceRange',
    });
    expect(
      issuesOf(
        agendaSettingsSchema.safeParse({ slot_minutes: 255, seats: 21, tolerance_minutes: -1 })
      )
    ).toEqual({
      slot_minutes: 'slotMinutesRange',
      seats: 'seatsRange',
      tolerance_minutes: 'toleranceRange',
    });
  });

  it('refuses blanks and decimals', () => {
    expect(
      issuesOf(
        agendaSettingsSchema.safeParse({
          slot_minutes: '',
          seats: '1.5',
          tolerance_minutes: 'diez',
        })
      )
    ).toEqual({
      slot_minutes: 'slotMinutesRange',
      seats: 'seatsRange',
      tolerance_minutes: 'toleranceRange',
    });
  });
});
