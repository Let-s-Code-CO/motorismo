/**
 * plate-city.utils — the list of cities a car plate can be issued in (spec 005, HU-07).
 *
 * A car keeps the municipality that issued its plate (RN-11), picked from the fixed DANE list
 * (RF-07). The form makes the common case fast (CA-30):
 * - the three cities the business sees most — Bogotá, D.C., La Calera and Funza — come first, in
 *   that order, and the rest follow alphabetically (Spanish order: "Ábrego" among the A's), a
 *   repeated name ordered by its department;
 * - typing filters without caring about case, accents, spaces or hyphens ("medellin" finds
 *   Medellín), the names that START with what is typed first.
 */
import type { Municipality } from '@web/modules/vehicles/types/vehicles.types';
import { filterPlateCities, sortPlateCities } from '@web/modules/vehicles/utils/plate-city.utils';

const city = (code: string, name: string, department = 'Antioquia'): Municipality => ({
  code,
  name,
  department,
});

const BOGOTA = city('11001', 'Bogotá, D.C.', 'Bogotá, D.C.');
const LA_CALERA = city('25377', 'La Calera', 'Cundinamarca');
const FUNZA = city('25286', 'Funza', 'Cundinamarca');
const MEDELLIN = city('05001', 'Medellín');
const ABREGO = city('54003', 'Ábrego', 'Norte de Santander');
const ARMENIA_QUINDIO = city('63001', 'Armenia', 'Quindío');
const ARMENIA_ANTIOQUIA = city('05059', 'Armenia', 'Antioquia');
const ZIPAQUIRA = city('25899', 'Zipaquirá', 'Cundinamarca');
const CALI = city('76001', 'Santiago de Cali', 'Valle del Cauca');
const CALDAS = city('05129', 'Caldas');

const names = (list: Municipality[]) => list.map((item) => `${item.name} (${item.department})`);

describe('sortPlateCities', () => {
  it('puts Bogotá, D.C., La Calera and Funza first, in that order, whatever order they arrive in (CA-30)', () => {
    const sorted = sortPlateCities([ZIPAQUIRA, FUNZA, MEDELLIN, LA_CALERA, BOGOTA]);

    expect(sorted.slice(0, 3)).toEqual([BOGOTA, LA_CALERA, FUNZA]);
  });

  it('orders the rest alphabetically in Spanish: an accented initial sorts with its letter (Ábrego among the A)', () => {
    const sorted = sortPlateCities([ZIPAQUIRA, MEDELLIN, CALI, ABREGO, BOGOTA]);

    expect(sorted.map((item) => item.name)).toEqual([
      'Bogotá, D.C.',
      'Ábrego',
      'Medellín',
      'Santiago de Cali',
      'Zipaquirá',
    ]);
  });

  it('orders a repeated name by its department (Armenia, Antioquia before Armenia, Quindío)', () => {
    expect(names(sortPlateCities([ARMENIA_QUINDIO, ARMENIA_ANTIOQUIA]))).toEqual([
      'Armenia (Antioquia)',
      'Armenia (Quindío)',
    ]);
  });

  it('does not change the list it receives', () => {
    const list = [ZIPAQUIRA, BOGOTA];

    sortPlateCities(list);

    expect(list).toEqual([ZIPAQUIRA, BOGOTA]);
  });

  it('returns an empty list for an empty list', () => {
    expect(sortPlateCities([])).toEqual([]);
  });
});

describe('filterPlateCities', () => {
  const list = sortPlateCities([
    BOGOTA,
    LA_CALERA,
    FUNZA,
    MEDELLIN,
    CALI,
    CALDAS,
    ARMENIA_ANTIOQUIA,
    ARMENIA_QUINDIO,
  ]);

  it('returns the whole list, in its order, when nothing is typed (or only spaces)', () => {
    expect(filterPlateCities(list, '')).toEqual(list);
    expect(filterPlateCities(list, '   ')).toEqual(list);
  });

  it.each([['medellin'], ['MEDELLÍN'], ['Medellin ']])(
    'finds Medellín typing "%s": case and accents do not matter (CA-30)',
    (typed) => {
      expect(filterPlateCities(list, typed)).toEqual([MEDELLIN]);
    }
  );

  it('ignores spaces and hyphens: "la cal" and "lacal" find La Calera', () => {
    expect(filterPlateCities(list, 'la cal')).toEqual([LA_CALERA]);
    expect(filterPlateCities(list, 'lacal')).toEqual([LA_CALERA]);
  });

  it('finds a city by any part of its official name ("cali" → Santiago de Cali), names that start with it first (Caldas)', () => {
    expect(filterPlateCities(list, 'cal').map((item) => item.name)).toEqual([
      'Caldas',
      'La Calera',
      'Santiago de Cali',
    ]);
  });

  it('keeps both homonyms, each with its department (CA-30)', () => {
    expect(names(filterPlateCities(list, 'armenia'))).toEqual([
      'Armenia (Antioquia)',
      'Armenia (Quindío)',
    ]);
  });

  it('returns nothing when no city matches', () => {
    expect(filterPlateCities(list, 'xyz')).toEqual([]);
  });
});
