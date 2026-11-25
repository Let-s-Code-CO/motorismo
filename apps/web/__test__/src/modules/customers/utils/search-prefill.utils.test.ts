/**
 * search-prefill.utils — what staff typed in the customer search, put in the field it belongs to when
 * they register the customer they did not find (spec 022, CA-04).
 *
 * Rules:
 * - A Colombian mobile (10 digits starting with 3, with or without +57 and separators) → «Celular»,
 *   written for reading.
 * - A plate (motorcycle ABC12D or ABC12, car ABC123; spec 005) → the first vehicle's plate, with the
 *   type it belongs to.
 * - Anything else → «Nombre completo».
 * - Nothing typed → nothing.
 */
import { prefillFromSearch } from '@web/modules/customers/utils/search-prefill.utils';

describe('prefillFromSearch', () => {
  it.each([
    ['300 123 4567', '300 123 4567'],
    ['3001234567', '300 123 4567'],
    ['+57 300-123-4567', '300 123 4567'],
  ])('puts a mobile, «%s», in «Celular» (%s)', (typed, phone) => {
    expect(prefillFromSearch(typed)).toEqual({ phone });
  });

  it.each([
    ['UIH-03D', 'motorcycle', 'UIH-03D'],
    ['uih 03d', 'motorcycle', 'UIH-03D'],
    ['ABC12', 'motorcycle', 'ABC-12'],
    ['KDM482', 'car', 'KDM-482'],
    ['kdm-482', 'car', 'KDM-482'],
  ] as const)('puts a plate, «%s», in the first vehicle as a %s (%s)', (typed, type, plate) => {
    expect(prefillFromSearch(typed)).toEqual({ vehicle: { vehicle_type: type, plate } });
  });

  it.each([
    ['Camila', 'Camila'],
    ['  Camila Cliente  ', 'Camila Cliente'],
    // Digits that are not a mobile (a landline, a document) are not a phone.
    ['6012345678', '6012345678'],
    ['Camila 300', 'Camila 300'],
  ])('puts anything else, «%s», in «Nombre completo»', (typed, fullName) => {
    expect(prefillFromSearch(typed)).toEqual({ full_name: fullName });
  });

  it('gives nothing when nothing was typed', () => {
    expect(prefillFromSearch('')).toEqual({});
    expect(prefillFromSearch('   ')).toEqual({});
  });
});
