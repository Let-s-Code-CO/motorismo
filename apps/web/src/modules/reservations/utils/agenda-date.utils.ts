import { TIME_ZONE } from '@web/i18n/messages';

/**
 * Days of the agenda as `YYYY-MM-DD`, always days of Colombia (spec 012, RN-09). Date-only
 * arithmetic runs on UTC midnights, so no device's time zone or daylight saving moves a day.
 */
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

const toUtc = (day: string) => {
  const [, year, month, date] = ISO_DAY.exec(day)!;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(date)));
};
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

/** Today in the business's time zone (RN-09): at 8 p. m. in Bogotá it is still today. */
export const todayIn = (now: Date, timeZone: string = TIME_ZONE) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

/** Whether `raw` is a real day written as `YYYY-MM-DD` (no 30 February). */
export const isAgendaDate = (raw: unknown): raw is string => {
  if (typeof raw !== 'string' || !ISO_DAY.test(raw)) return false;
  return fromUtc(toUtc(raw)) === raw;
};

/** The day of the URL, or today when it is missing or not a real day (CA-10). */
export const parseAgendaDate = (raw: string | undefined | null, today: string) =>
  isAgendaDate(raw) ? raw : today;

export const addDays = (day: string, days: number) => {
  const date = toUtc(day);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
};

/** The Monday of the week of `day` (CA-26): Sunday closes its week. */
export const weekStartOf = (day: string) => {
  const weekday = toUtc(day).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
};

/** The seven days of the week that starts on `weekStart`, Monday first. */
export const weekDays = (weekStart: string) =>
  Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
