/**
 * nav-overflow.utils — how many entries of the desktop bar fit in line; the rest go to «Más ▾»
 * (spec 018, HU-05).
 *
 * Guards:
 * - CA-22: when every entry fits, there is no «Más».
 * - CA-25: when they do not, the entries leave from the end, and the room of «Más» itself counts;
 *   «Inicio», the first one, always stays.
 * The widths are in pixels; each case shows its sum.
 */
import { visibleCount } from '@web/modules/auth/utils/nav-overflow.utils';

const WIDTHS = [60, 80, 70, 75, 130]; // Inicio, Órdenes, Agenda, Clientes, Administración ▾
const MORE = 60; // «Más ▾»
const GAP = 4;

describe('visibleCount', () => {
  it('keeps every entry when they all fit: 60+80+70+75+130 + 4×4 gaps = 431 ≤ 431 (CA-22)', () => {
    expect(visibleCount(WIDTHS, 431, MORE, GAP)).toBe(5);
  });

  it('takes the last one out when one pixel is missing, leaving room for «Más»: 60+80+70+75 + 3×4 = 297, + 4 + 60 = 361 ≤ 430 (CA-25)', () => {
    expect(visibleCount(WIDTHS, 430, MORE, GAP)).toBe(4);
  });

  it('takes out as many as needed, from the end: 60+80 + 4 = 144, + 4 + 60 = 208 ≤ 220 (CA-25)', () => {
    expect(visibleCount(WIDTHS, 220, MORE, GAP)).toBe(2);
  });

  it('never leaves fewer than one entry, even with no room at all (Inicio stays, CA-25)', () => {
    expect(visibleCount(WIDTHS, 0, MORE, GAP)).toBe(1);
  });

  it('keeps everything when there is nothing to show', () => {
    expect(visibleCount([], 100, MORE, GAP)).toBe(0);
  });

  it('keeps everything when nothing has been measured yet (widths and room at 0)', () => {
    expect(visibleCount([0, 0, 0], 0, 0, 0)).toBe(3);
  });
});
