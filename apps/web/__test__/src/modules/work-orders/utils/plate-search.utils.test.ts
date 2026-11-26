/**
 * plate-search.utils — which plate a customer search matched (spec 022, CA-11).
 *
 * The search finds customers by name, phone, email or plate (spec 008, CA-01). A result shows a plate
 * only when the search matched one of the customer's active plates:
 * - what was typed, written as plates are stored (uppercase, without spaces, hyphens or dots), is
 *   looked for inside each plate («uih» matches UIH-03D and UIH-58E);
 * - only text that could be part of a plate is looked for: letters and digits, at least two;
 * - a customer found by name, phone or email has no plate that contains the text, so none is shown;
 * - the plate comes with the city that issued it if it is a car's (a motorcycle's has none).
 */
import { matchedPlates, plateQuery } from '@web/modules/work-orders/utils/plate-search.utils';

describe('plateQuery', () => {
  it.each([
    ['UIH-03D', 'UIH03D'],
    ['uih 03d', 'UIH03D'],
    ['uih', 'UIH'],
    ['kdm.482', 'KDM482'],
  ])('writes «%s» as plates are stored: %s', (typed, query) => {
    expect(plateQuery(typed)).toBe(query);
  });

  it.each([
    ['a single character', 'u'],
    ['nothing', '   '],
    ['an email', 'cliente@motorismo.test'],
    ['a name with accents', 'Andrés'],
  ])('looks for no plate with %s', (_, typed) => {
    expect(plateQuery(typed)).toBeNull();
  });
});

describe('matchedPlates', () => {
  const vehicle = (
    customer_id: string,
    plate: string,
    city: string | null = null,
    legend: string | null = null
  ) => ({
    customer_id,
    plate,
    plate_city: city ? { name: city, plate_legend: legend } : null,
  });
  const vehicles = [
    vehicle('camila', 'UIH03D'),
    vehicle('gabriel', 'GGM45F'),
    vehicle('gabriel', 'UIH58E'),
    vehicle('valentina', 'KDM482', 'Bogotá, D.C.', 'STFE DE BOGOTA'),
    vehicle('gabriel', 'KDM917', 'Medellín'),
  ];

  it('gives each customer the plate that contains what was typed (CA-11)', () => {
    expect(matchedPlates(vehicles, 'UIH')).toEqual(
      new Map([
        ['camila', { plate: 'UIH03D', city: null, legend: null }],
        ['gabriel', { plate: 'UIH58E', city: null, legend: null }],
      ])
    );
  });

  it("gives a car's plate with the city that issued it and its own legend, if any (CA-11; spec 023, CA-10)", () => {
    expect(matchedPlates(vehicles, 'KDM')).toEqual(
      new Map([
        ['valentina', { plate: 'KDM482', city: 'Bogotá, D.C.', legend: 'STFE DE BOGOTA' }],
        ['gabriel', { plate: 'KDM917', city: 'Medellín', legend: null }],
      ])
    );
  });

  it('gives nothing when no plate contains it, e.g. a customer found by name (CA-11)', () => {
    expect(matchedPlates(vehicles, 'CAMILA')).toEqual(new Map());
  });
});
