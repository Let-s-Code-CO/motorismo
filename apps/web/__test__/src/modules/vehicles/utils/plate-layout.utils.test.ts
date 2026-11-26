/**
 * plate-layout.utils — where everything goes on a plate, in millimetres (spec 023, CA-01, CA-02,
 * CA-09, RN-01).
 *
 * The norm's measurements (ficha MT 001; Res. 3257 de 2018, Anexos 1 y 2) must add up exactly:
 * - car, 330 × 160: frame 4 mm in and 4 mm thick; characters of 40 × 80, 8 apart, a 26 mm gap with the
 *   circle in the middle; the city under them, 8 mm below, in letters of 12 × 22, 5 apart;
 * - motorcycle, 235 × 105: frame 3 mm in and 2.5 thick; characters of 28 × 54, 5 apart, the same
 *   26 mm gap; «COLOMBIA» 9.5 mm below, in letters of 5 × 10.5, 5 apart;
 * - characters and legend are centred inside the frame (the drawings of antique plates carry the
 *   word ANTIGUO or CLÁSICO on top; a common plate does not);
 * - a legend wider than the room inside the frame is reduced, all of it, just enough to fit (CA-09);
 * - on a screen, a plate drawn small would leave its legend unreadable (COLOMBIA is 10.5 mm high): the
 *   legend may grow towards a readable size, never taking the gap above it, and characters and legend
 *   are centred again inside the frame; it never grows past the room it has.
 */
import { plateKind, plateLayout } from '@web/modules/vehicles/utils/plate-layout.utils';

describe('plateKind', () => {
  it.each([
    ['ABC123', 'car'],
    ['UIH03D', 'moto'],
    ['JWJ07', 'moto'],
  ] as const)('tells a %s plate is a %s plate', (plate, kind) => {
    expect(plateKind(plate)).toBe(kind);
  });
});

describe('plateLayout', () => {
  it('lays a car plate out with the norm: 4 + 4 + 8 + (40 + 8) × 2 + 40 + 26 + 40 + (8 + 40) × 2 + 8 + 4 + 4 = 330 (CA-01)', () => {
    const car = plateLayout('car', 'BOGOTA');

    expect(car.size).toEqual([330, 160]);
    expect(car.characters.map(({ x }) => x)).toEqual([16, 64, 112, 178, 226, 274]);
    // The last character ends 16 mm before the edge: 8 of space, 4 of frame, 4 of margin.
    expect(car.characters.at(-1)!.x + 40 + 8 + 4 + 4).toBe(330);
    // The 26 mm gap between letters and digits, with the circle in its middle.
    expect(car.characters[3]!.x - (car.characters[2]!.x + 40)).toBe(26);
    expect(car.circle).toMatchObject({ cx: 165, r: 8 });
  });

  it('centres a car plate vertically inside the frame: 17 + 80 + 8 + 22 + 17 = 144 (CA-01)', () => {
    const car = plateLayout('car', 'BOGOTA');

    // The frame leaves 160 − 2 × 8 = 144 mm inside; the block is 80 + 8 + 22 = 110.
    expect(car.characters[0]!.y).toBe(25);
    expect(car.legend.y).toBe(113);
    expect(car.circle.cy).toBe(65);
    expect(car.frame).toEqual({ inset: 6, width: 4, radius: 6 });
  });

  it('lays a motorcycle plate out with the norm: 3 + 2.5 + 5 + (28 + 5) × 2 + 28 + 26 + … = 235 (CA-02)', () => {
    const moto = plateLayout('moto', 'COLOMBIA');

    expect(moto.size).toEqual([235, 105]);
    expect(moto.characters.map(({ x }) => x)).toEqual([10.5, 43.5, 76.5, 130.5, 163.5, 196.5]);
    expect(moto.characters.at(-1)!.x + 28 + 5 + 2.5 + 3).toBe(235);
    expect(moto.characters[0]!.y).toBe(15.5);
    // «COLOMBIA»: 8 letters of 5 and 7 gaps of 5 = 75 mm, centred: (235 − 75) / 2 = 80.
    expect(moto.legend).toMatchObject({ x: 80, y: 79, width: 75, scale: 1 });
    expect(moto.circle).toMatchObject({ cx: 117.5, cy: 42.5, r: 7.5 });
  });

  it('centres a car legend that fits at the norm size: BOGOTA, 6 × 12 + 5 × 5 = 97 mm (CA-01)', () => {
    const { legend } = plateLayout('car', 'BOGOTA');

    expect(legend.width).toBe(97);
    expect(legend.scale).toBe(1);
    expect(legend.x).toBe((330 - 97) / 2);
    expect(legend.glyphs.map(({ character }) => character).join('')).toBe('BOGOTA');
  });

  it('reduces a legend too wide for the frame just enough to fit, never cutting it (CA-09)', () => {
    // 26 letters: 26 × 12 + 25 × 5 = 437 mm, wider than the 298 mm of room inside the frame.
    const { legend } = plateLayout('car', 'SAN ANTONIO DEL TEQUENDAMA');

    expect(legend.width).toBeCloseTo(298);
    expect(legend.scale).toBeLessThan(1);
    expect(legend.x).toBeCloseTo(16);
    expect(legend.glyphs).toHaveLength(26);
  });

  it('gives punctuation only its inked width: «D.C.» is narrower than four letters', () => {
    const fourLetters = plateLayout('car', 'DDCC').legend.width;
    expect(plateLayout('car', 'D.C.').legend.width).toBeLessThan(fourLetters);
  });

  it('grows a legend for the screen and centres the block again, gap kept: 54 + 9.5 + 14.7 = 78.2 in 94 (CA-02)', () => {
    const moto = plateLayout('moto', 'COLOMBIA', { grow: 1.4 });

    // 10.5 × 1.4 = 14.7 mm high, 75 × 1.4 = 105 mm wide.
    expect(moto.legend.scale).toBe(1.4);
    expect(moto.legend.width).toBeCloseTo(105);
    expect(moto.legend.x).toBeCloseTo((235 - 105) / 2);
    // Inside the frame, 5.5 to 99.5: (94 − 78.2) / 2 = 7.9 above and below.
    expect(moto.characters[0]!.y).toBeCloseTo(5.5 + 7.9);
    // The norm's 9.5 mm between characters and legend stays whole.
    expect(moto.legend.y).toBeCloseTo(5.5 + 7.9 + 54 + 9.5);
    // The circle stays at the middle of the characters.
    expect(moto.circle.cy).toBeCloseTo(5.5 + 7.9 + 27);
  });

  it('never grows a legend past the room inside the frame, across or down', () => {
    // «BARRANCABERMEJA»: 15 × 12 + 14 × 5 = 250 mm; × 1.5 would be 375, more than the 298 across.
    const wide = plateLayout('car', 'BARRANCABERMEJA', { grow: 1.5 }).legend;
    expect(wide.width).toBeCloseTo(298);
    expect(wide.scale).toBeCloseTo(298 / 250);

    // Down, it keeps the gap and half the norm's margin (17) above and below:
    // 144 − 80 − 8 − 2 × 8.5 = 39 mm for a legend of 22.
    const tall = plateLayout('car', 'I', { grow: 4 }).legend;
    expect(tall.scale).toBeCloseTo(39 / 22);
  });
});
