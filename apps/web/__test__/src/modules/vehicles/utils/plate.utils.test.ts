/**
 * plate.utils — the Colombian plate of a vehicle (spec 005, RN-02 / RN-03).
 *
 * The plate is how staff recognise the vehicle that arrives. It is typed in any way ("uih03d",
 * "UIH 03D", "uih-03d"), stored in one canonical form (uppercase, no separators) and shown with a
 * hyphen after the three letters. The valid shapes depend on the type:
 * - motorcycle: three letters, two digits and a letter (UIH03D), or the old three letters and two
 *   digits (JWJ07);
 * - car: three letters and three digits (ABC123);
 * - bicycle: no plate at all.
 * The database applies the same rules (vehicles_guard); these keep the form honest (CA-03, CA-05).
 */
import {
  formatPlate,
  hasPlate,
  isValidPlate,
  normalizePlate,
} from '@web/modules/vehicles/utils/plate.utils';

describe('normalizePlate', () => {
  it.each([
    ['uih03d', 'UIH03D'],
    ['UIH 03D', 'UIH03D'],
    ['uih-03d', 'UIH03D'],
    [' jwj 07 ', 'JWJ07'],
    ['abc.123', 'ABC123'],
    ['', ''],
  ])('turns "%s" into "%s" (uppercase, without spaces, hyphens or dots)', (raw, expected) => {
    expect(normalizePlate(raw)).toBe(expected);
  });
});

describe('isValidPlate', () => {
  it.each(['UIH03D', 'uih-03d', 'JWJ07', 'jwj 07'])(
    'accepts the motorcycle plate "%s" (three letters, two digits and an optional letter)',
    (plate) => {
      expect(isValidPlate('motorcycle', plate)).toBe(true);
    }
  );

  it.each([
    ['ABC123', 'a car plate'],
    ['UI03D', 'two letters'],
    ['UIH3D', 'one digit'],
    ['UIH03DD', 'two final letters'],
    ['', 'nothing'],
  ])('rejects "%s" for a motorcycle (%s)', (plate) => {
    expect(isValidPlate('motorcycle', plate)).toBe(false);
  });

  it.each(['ABC123', 'abc-123', 'abc 123'])('accepts the car plate "%s"', (plate) => {
    expect(isValidPlate('car', plate)).toBe(true);
  });

  it.each([
    ['UIH03D', 'a motorcycle plate'],
    ['JWJ07', 'an old motorcycle plate'],
    ['ABC1234', 'four digits'],
  ])('rejects "%s" for a car (%s) — CA-05', (plate) => {
    expect(isValidPlate('car', plate)).toBe(false);
  });
});

describe('hasPlate', () => {
  it('says motorcycles and cars carry a plate and bicycles do not (RN-02)', () => {
    expect(hasPlate('motorcycle')).toBe(true);
    expect(hasPlate('car')).toBe(true);
    expect(hasPlate('bicycle')).toBe(false);
  });
});

describe('formatPlate', () => {
  it.each([
    ['UIH03D', 'UIH-03D'],
    ['uih03d', 'UIH-03D'],
    ['jwj 07', 'JWJ-07'],
    ['ABC123', 'ABC-123'],
  ])('shows "%s" as "%s" (hyphen after the three letters) — CA-03', (plate, expected) => {
    expect(formatPlate(plate)).toBe(expected);
  });

  it('leaves a partial plate of three characters or fewer as it is', () => {
    expect(formatPlate('ui')).toBe('UI');
  });
});
