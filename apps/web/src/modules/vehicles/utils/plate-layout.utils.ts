import { PLATE_GLYPHS } from '@web/modules/vehicles/constants/plate-glyphs.constants';

/**
 * Where everything goes on a Colombian plate, in millimetres (spec 023, CA-01, CA-02, RN-01): the
 * measurements of the norm (ficha MT 001; Res. 3257 de 2018, Anexos 1 y 2). The drawings carry the word
 * ANTIGUO or CLÁSICO on top; a common plate does not, so characters and legend are centred inside the
 * frame instead.
 */
export type PlateKind = 'car' | 'moto';

/** A car plate is three letters and three digits; anything else (ABC12D, ABC12) is a motorcycle's. */
const CAR_PLATE = /^[A-Z]{3}\d{3}$/;

export const plateKind = (plate: string): PlateKind => (CAR_PLATE.test(plate) ? 'car' : 'moto');

type Spec = {
  size: [number, number];
  /** Corner radius of the plate. */
  radius: number;
  /** The embossed frame: how far from the edge it starts, how thick it is, its outer radius. */
  frame: { margin: number; thickness: number; outerRadius: number };
  /** Left edge of each of the six characters, their top and their height. */
  characters: { x: number[]; y: number; height: number };
  circle: { cx: number; cy: number; r: number };
  /** The legend: its glyph set, the gap between letters, its top and the room it may take. */
  legend: { set: 'legend' | 'colombia'; gap: number; y: number; room: [number, number] };
};

export const PLATE_SPECS: Record<PlateKind, Spec> = {
  // Car sheet, Figura 1 (PDF p. 13): 4 + 4 + 8 + (40 + 8 + 40 + 8 + 40) + 26 + (…) + 8 + 4 + 4 = 330.
  // Vertically the block 80 + 8 + 22 = 110 is centred in the 144 mm inside the frame: 17 above and below.
  car: {
    size: [330, 160],
    radius: 12,
    frame: { margin: 4, thickness: 4, outerRadius: 8 },
    characters: { x: [16, 64, 112, 178, 226, 274], y: 25, height: 80 },
    circle: { cx: 165, cy: 65, r: 8 },
    // The legend may take the width of the characters, 16 to 314.
    legend: { set: 'legend', gap: 5, y: 113, room: [16, 314] },
  },
  // Motorcycle sheet (PDF p. 45): 3 + 2.5 + 5 + (28 + 5 + 28 + 5 + 28) + 26 + (…) + 5 + 2.5 + 3 = 235.
  // Vertically 54 + 9.5 + 10.5 = 74, centred in the 94 mm inside the frame: 10 above and below.
  moto: {
    size: [235, 105],
    radius: 8,
    frame: { margin: 3, thickness: 2.5, outerRadius: 5.5 },
    characters: { x: [10.5, 43.5, 76.5, 130.5, 163.5, 196.5], y: 15.5, height: 54 },
    circle: { cx: 117.5, cy: 42.5, r: 7.5 },
    legend: { set: 'colombia', gap: 5, y: 79, room: [10.5, 224.5] },
  },
};

export type LegendGlyph = {
  character: string;
  /** Where the glyph's cell starts, in the legend's own (unscaled) millimetres. */
  x: number;
  /** Its path, or null for a space. */
  path: string | null;
};

export type PlateLayout = {
  kind: PlateKind;
  size: [number, number];
  radius: number;
  /** The frame as a stroked rectangle: its centre line `inset` from the edge, `width` thick. */
  frame: { inset: number; width: number; radius: number };
  characters: { x: number; y: number }[];
  circle: { cx: number; cy: number; r: number };
  legend: {
    /** Left and top of the legend on the plate, after scaling. */
    x: number;
    y: number;
    /** Width on the plate, after scaling. */
    width: number;
    /** 1 at the norm's size; less for a legend too wide for its room (CA-09). */
    scale: number;
    glyphs: LegendGlyph[];
  };
};

/**
 * The legend's glyphs side by side: letters take their cell, punctuation only its ink, and a space the
 * width of a letter; the norm's gap goes between each two.
 */
const layLegend = (text: string, set: 'legend' | 'colombia', gap: number) => {
  const glyphSet = PLATE_GLYPHS[set];
  const inkX: Record<string, readonly [number, number]> = 'inkX' in glyphSet ? glyphSet.inkX : {};
  const [cellWidth] = glyphSet.cell;
  let cursor = 0;
  const glyphs = [...text].map((character, index) => {
    const ink = inkX[character];
    const advance = ink ? ink[1] - ink[0] : cellWidth;
    const start = cursor + (index === 0 ? 0 : gap);
    cursor = start + advance;
    return {
      character,
      // Punctuation's cell starts before its ink, so the ink lands at `start`.
      x: ink ? start - ink[0] : start,
      path: character === ' ' ? null : (glyphSet.glyphs[character] ?? null),
    };
  });
  return { glyphs, width: cursor };
};

type LayoutOptions = {
  /**
   * How much larger than the norm to draw the legend (1 by default). On a screen, a plate drawn small
   * leaves its legend unreadable; it may grow, never past the room inside the frame: it keeps the gap
   * under the characters and half the norm's margins.
   */
  grow?: number;
};

/** Lays a plate out: the six characters, the circle and the legend, centred and fitted. */
export const plateLayout = (
  kind: PlateKind,
  legendText: string,
  { grow = 1 }: LayoutOptions = {}
): PlateLayout => {
  const spec = PLATE_SPECS[kind];
  const [plateWidth, plateHeight] = spec.size;
  const { margin, thickness, outerRadius } = spec.frame;
  const [roomStart, roomEnd] = spec.legend.room;
  const room = roomEnd - roomStart;
  const height = PLATE_GLYPHS[spec.legend.set].cell[1];

  // Inside the frame, and the norm's gap between characters and legend.
  const innerTop = margin + thickness;
  const innerHeight = plateHeight - 2 * innerTop;
  const charactersBottom = spec.characters.y + spec.characters.height;
  const gap = spec.legend.y - charactersBottom;
  // Down, a grown legend keeps the norm's gap above it and takes at most half of the margins above the
  // characters and below the legend: the plate keeps its air.
  const normMargin = spec.characters.y - innerTop;
  const roomDown = innerHeight - spec.characters.height - gap - normMargin;

  const { glyphs, width: natural } = layLegend(legendText, spec.legend.set, spec.legend.gap);
  const scale = Math.min(grow, room / natural, roomDown / height);
  const width = natural * scale;

  // At the norm's size or smaller, the norm's places (a reduced legend centred on its line); a grown
  // legend makes the block taller, so characters and legend are centred again inside the frame.
  const grown = scale > 1;
  const top = grown
    ? innerTop + (innerHeight - (spec.characters.height + gap + height * scale)) / 2
    : spec.characters.y;
  const legendY = grown
    ? top + spec.characters.height + gap
    : spec.legend.y + (height * (1 - scale)) / 2;

  return {
    kind,
    size: spec.size,
    radius: spec.radius,
    frame: {
      inset: margin + thickness / 2,
      width: thickness,
      radius: outerRadius - thickness / 2,
    },
    characters: spec.characters.x.map((x) => ({ x, y: top })),
    circle: { ...spec.circle, cy: spec.circle.cy + (top - spec.characters.y) },
    legend: { x: (plateWidth - width) / 2, y: legendY, width, scale, glyphs },
  };
};
