/**
 * agenda-date.utils — the days of the agenda, as the car wash counts them (spec 012).
 *
 * The agenda shows one day at a time and the admin enables one week at a time (Monday to Sunday).
 * Days travel in the URL as `YYYY-MM-DD` and are always days of Colombia (RN-09): at 8 p. m. in
 * Bogotá it is already tomorrow in UTC, and the agenda must still say «today».
 *
 * Guards:
 * - CA-10: going to the previous or the next day, across months and years; a missing or invalid
 *   `date` in the URL means today.
 * - CA-26: the Monday of any day's week, and its seven days, for «Horario».
 */
import {
  addDays,
  parseAgendaDate,
  todayIn,
  weekDays,
  weekStartOf,
} from '@web/modules/reservations/utils/agenda-date.utils';

describe('todayIn', () => {
  it('is the day in Colombia, not in UTC (RN-09)', () => {
    // 2030-06-13 01:30 UTC is 2030-06-12 8:30 p. m. in Bogotá (UTC−5).
    expect(todayIn(new Date('2030-06-13T01:30:00Z'))).toBe('2030-06-12');
  });

  it("uses the business's time zone, not the device's (the tests run in Bogotá too)", () => {
    // The same instant is already 13 June in UTC.
    expect(todayIn(new Date('2030-06-13T01:30:00Z'), 'UTC')).toBe('2030-06-13');
  });

  it('turns at midnight in Colombia', () => {
    // 05:00 UTC is midnight in Bogotá.
    expect(todayIn(new Date('2030-06-13T05:00:00Z'))).toBe('2030-06-13');
  });
});

describe('parseAgendaDate', () => {
  it('keeps a real day from the URL (CA-10: it survives a reload)', () => {
    expect(parseAgendaDate('2030-06-15', '2030-06-12')).toBe('2030-06-15');
  });

  it.each([undefined, '', 'mañana', '2030-6-1', '2030-02-30', '2030-13-01', '20300612'])(
    'falls back to today for %j (CA-10)',
    (raw) => {
      expect(parseAgendaDate(raw, '2030-06-12')).toBe('2030-06-12');
    }
  );
});

describe('addDays', () => {
  it('goes to the next and the previous day (CA-10)', () => {
    expect(addDays('2030-06-12', 1)).toBe('2030-06-13');
    expect(addDays('2030-06-12', -1)).toBe('2030-06-11');
  });

  it('crosses months and years', () => {
    expect(addDays('2030-06-30', 1)).toBe('2030-07-01');
    expect(addDays('2030-01-01', -1)).toBe('2029-12-31');
    // 2028 is a leap year: 28 February + 1 = 29 February.
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('weekStartOf and weekDays', () => {
  it('finds the Monday of a day of the week (CA-26)', () => {
    // 2030-06-12 is a Wednesday; its week starts on Monday 10 June.
    expect(weekStartOf('2030-06-12')).toBe('2030-06-10');
    expect(weekStartOf('2030-06-10')).toBe('2030-06-10');
  });

  it('puts Sunday at the end of its week, never at the start of the next', () => {
    expect(weekStartOf('2030-06-16')).toBe('2030-06-10');
  });

  it('lists the seven days, Monday first, across a month', () => {
    expect(weekDays('2026-11-30')).toEqual([
      '2026-11-30',
      '2026-12-01',
      '2026-12-02',
      '2026-12-03',
      '2026-12-04',
      '2026-12-05',
      '2026-12-06',
    ]);
  });
});
