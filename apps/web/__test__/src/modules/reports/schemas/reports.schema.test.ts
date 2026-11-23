/**
 * reportFiltersSchema — how the services report reads its filters from the address (spec 015,
 * HU-01).
 *
 * The filters live in the URL (CA-05), so anything there can be wrong or stale; the report never
 * fails because of it, it falls back to what an admin sees on opening it.
 *
 * Guards:
 * - CA-01: by default, this month from day 1 to today (a day of Colombia, given by the page).
 * - CA-02: a range given in the address is kept, both ends; a day that does not exist, or a «from»
 *   after «to», goes back to the default period (both ends, never half a range).
 * - CA-03: an employee is their id; anything else means «all employees».
 * - CA-04: a plate with dash, spaces or in lower case is the same plate, as the database compares it.
 * - CA-11: the page is a whole number from 1; anything else is page 1.
 */
import { reportFiltersSchema } from '@web/modules/reports/schemas/reports.schema';

/** «Today» in Bogotá for these tests: 23 November 2026. */
const TODAY = '2026-11-23';
const parse = (params: Record<string, string | string[] | undefined>) =>
  reportFiltersSchema(TODAY).parse(params);

const EMPLOYEE = '6f1d2c3b-4a59-4e8f-9b0a-1c2d3e4f5a6b';

describe('reportFiltersSchema', () => {
  it('opens on this month, from day 1 to today, with no employee, no plate and page 1 (CA-01)', () => {
    expect(parse({})).toEqual({
      from: '2026-11-01',
      to: '2026-11-23',
      employee: null,
      plate: '',
      page: 1,
    });
  });

  it('starts on day 1 also on the first day of the month (from = to = today)', () => {
    expect(reportFiltersSchema('2026-12-01').parse({})).toMatchObject({
      from: '2026-12-01',
      to: '2026-12-01',
    });
  });

  it('keeps the range of the address, both ends (CA-02)', () => {
    expect(parse({ from: '2026-10-05', to: '2026-10-20' })).toMatchObject({
      from: '2026-10-05',
      to: '2026-10-20',
    });
  });

  it('accepts a single day: «from» equal to «to» (CA-02)', () => {
    expect(parse({ from: '2026-10-05', to: '2026-10-05' })).toMatchObject({
      from: '2026-10-05',
      to: '2026-10-05',
    });
  });

  it.each([
    ['a day that does not exist', { from: '2026-02-30', to: '2026-03-10' }],
    ['a date in another format', { from: '05/10/2026', to: '2026-10-20' }],
    ['«from» after «to»', { from: '2026-10-21', to: '2026-10-20' }],
    ['only one end', { from: '2026-10-05' }],
  ])('goes back to this month, both ends, for %s (CA-02)', (_, params) => {
    expect(parse(params)).toMatchObject({ from: '2026-11-01', to: '2026-11-23' });
  });

  it('keeps an employee given by their id (CA-03)', () => {
    expect(parse({ employee: EMPLOYEE }).employee).toBe(EMPLOYEE);
  });

  it.each([['not-an-id'], ['']])('means «all employees» for «%s» (CA-03)', (employee) => {
    expect(parse({ employee }).employee).toBeNull();
  });

  it.each([
    ['uih-03d', 'UIH03D'],
    [' UIH 03D ', 'UIH03D'],
    ['kdm.482', 'KDM482'],
    ['', ''],
  ])('reads the plate «%s» as «%s», as the database compares it (CA-04)', (plate, expected) => {
    expect(parse({ plate }).plate).toBe(expected);
  });

  it('keeps no more than 10 characters of a plate (a Colombian plate has 6)', () => {
    expect(parse({ plate: 'ABCDEFGHIJKLMNOP' }).plate).toBe('ABCDEFGHIJ');
  });

  it('keeps a page number from 1 (CA-11)', () => {
    expect(parse({ page: '3' }).page).toBe(3);
  });

  it.each([['0'], ['-2'], ['1.5'], ['two']])('reads the page «%s» as page 1 (CA-11)', (page) => {
    expect(parse({ page }).page).toBe(1);
  });

  it('takes the first value when the address repeats a filter (?plate=a&plate=b)', () => {
    expect(parse({ plate: ['uih-03d', 'kdm-482'] }).plate).toBe('UIH03D');
  });
});
