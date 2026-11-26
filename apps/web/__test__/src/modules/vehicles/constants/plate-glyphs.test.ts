/**
 * plate-glyphs.constants — the characters of the plate, traced from the norm's drawings (spec 023,
 * CA-04, RN-02).
 *
 * The norm names no typeface: it draws each letter and digit on a grid (Res. 3257 de 2018, Anexos 1
 * and 2). The glyphs are the centre line of those strokes, drawn with the norm's thickness. Guards:
 * - every character a plate can carry exists: A–Z and 0–9 for cars and motorcycles; for the city
 *   legend, A–Z, Ñ, 0–9 and «. , -»; and the letters of «COLOMBIA»;
 * - each glyph stays inside its cell, so characters never touch;
 * - the O and the 0 are different, as in the drawings;
 * - the M is drawn as the norm draws it: its V starts at the top of both stems and points down to the
 *   middle of the base, its two strokes meeting there, never crossing.
 */
import { PLATE_GLYPHS } from '@web/modules/vehicles/constants/plate-glyphs.constants';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DIGITS = '0123456789'.split('');

/** Every coordinate a path names (M, L, H, V, C, A and Z with absolute values). */
const extent = (d: string) => {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [, command = '', args = ''] of d.matchAll(/([MLHVCAZ])([^MLHVCAZ]*)/gi)) {
    const values = args
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    const upper = command.toUpperCase();
    if (upper === 'H') xs.push(...values);
    else if (upper === 'V') ys.push(...values);
    else if (upper === 'A')
      for (let i = 0; i + 6 < values.length + 1; i += 7) {
        xs.push(values[i + 5]!);
        ys.push(values[i + 6]!);
      }
    else
      // M, L and C: pairs of x, y (a C's control points included).
      for (let i = 0; i + 1 < values.length; i += 2) {
        xs.push(values[i]!);
        ys.push(values[i + 1]!);
      }
  }
  return { xs, ys };
};

describe('PLATE_GLYPHS', () => {
  it.each([
    ['car', [...LETTERS, ...DIGITS]],
    ['moto', [...LETTERS, ...DIGITS]],
    ['legend', [...LETTERS, 'Ñ', ...DIGITS, '.', ',', '-']],
    ['colombia', 'COLMBIA'.split('')],
  ] as const)('has every character a %s plate can carry', (set, characters) => {
    expect(Object.keys(PLATE_GLYPHS[set].glyphs).sort()).toEqual(
      expect.arrayContaining([...characters].sort())
    );
  });

  it.each(['car', 'moto', 'legend', 'colombia'] as const)(
    'keeps the centre line of every %s glyph inside its cell',
    (set) => {
      // With butt caps a stroke that ends on an edge does not cross it (the base of the 2 runs from
      // x = 0 to 40); that no ink leaves the cell was checked by rasterising every glyph at 20 and
      // 100 px/mm when they were traced.
      const { cell, glyphs } = PLATE_GLYPHS[set];
      const [width, height] = cell;
      for (const [character, d] of Object.entries(glyphs)) {
        const { xs, ys } = extent(d);
        expect(Math.min(...xs), character).toBeGreaterThanOrEqual(-0.01);
        expect(Math.max(...xs), character).toBeLessThanOrEqual(width + 0.01);
        expect(Math.min(...ys), character).toBeGreaterThanOrEqual(-0.01);
        expect(Math.max(...ys), character).toBeLessThanOrEqual(height + 0.01);
      }
    }
  );

  it.each(['car', 'moto'] as const)('draws the O and the 0 differently on a %s plate', (set) => {
    expect(PLATE_GLYPHS[set].glyphs.O).not.toBe(PLATE_GLYPHS[set].glyphs['0']);
  });

  it.each(['car', 'moto', 'legend'] as const)(
    'draws the M of a %s plate with its V meeting in the middle, never crossing',
    (set) => {
      const { cell, glyphs } = PLATE_GLYPHS[set];
      const middle = cell[0] / 2;
      // The V is one stroke: down from the top of one stem to the middle, up to the other.
      const v = glyphs.M!.match(/M[^M]*L[^M]*L[^M]*L[^M]*L[^M]*$/)![0];
      const points = [...v.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)].map(([, x, y]) => [
        Number(x),
        Number(y),
      ]);
      const xs = points.map(([x]) => x!);
      const bottom = points.reduce((low, point) => (point[1]! > low[1]! ? point : low));
      expect(bottom[0]).toBeCloseTo(middle);
      // Left of the middle going down, right of it going up: the strokes never cross.
      expect(xs.slice(0, 3).every((x) => x <= middle)).toBe(true);
      expect(xs.slice(3).every((x) => x >= middle)).toBe(true);
    }
  );
});
