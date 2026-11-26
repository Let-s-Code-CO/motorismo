import { useId } from 'react';

import { useTranslations } from 'next-intl';

import { PLATE_GLYPHS } from '@web/modules/vehicles/constants/plate-glyphs.constants';
import {
  PLATE_SPECS,
  plateKind,
  plateLayout,
} from '@web/modules/vehicles/utils/plate-layout.utils';
import { plateLegend } from '@web/modules/vehicles/utils/plate-legend.utils';
import { formatPlate, normalizePlate } from '@web/modules/vehicles/utils/plate.utils';

type PlateLabelProps = {
  plate: string;
  /** The city that issued a car plate (spec 005, RN-11); motorcycles say «COLOMBIA» instead. */
  city?: string | null;
  /** The city's own legend for the plate, when the admin gave it one (spec 023, HU-03). */
  legend?: string | null;
  /** `sm`: the same whole plate, a little smaller, for lists of customers (spec 023, CA-12). */
  size?: 'md' | 'sm';
  className?: string;
};

/*
 * Every plate of one size has the same width, whatever its letters (spec 023, CA-03): the norm fixes
 * the proportions, not the text. `md`, 80 px, keeps the height plates had before (about 35 px): 36 for
 * a motorcycle (80 × 105 / 235) and 39 for a car (80 × 160 / 330). `sm`, 72 px, in lists (CA-12).
 */
const WIDTH = { md: 'w-[5rem]', sm: 'w-[4.5rem]' } as const;
/** The same widths in CSS pixels (1rem = 16 px), to know how large a millimetre is drawn. */
const WIDTH_PX = { md: 80, sm: 72 } as const;
const ASPECT = { car: 'aspect-[330/160]', moto: 'aspect-[235/105]' } as const;

/*
 * A screen is not a plate: at these widths the norm's legend is a few pixels high (COLOMBIA, 10.5 mm,
 * is under 4 px with a 0.3 px stroke). A legend under LEGEND_MIN_PX grows towards it, never more than
 * LEGEND_MAX_GROW times the norm, so the plate keeps its proportions: a car's city (5.3 px at `md`)
 * stays as the norm draws it; COLOMBIA grows to about 5 px. Thin lines are drawn at least
 * MIN_STROKE_PX wide.
 */
const LEGEND_MIN_PX = 5;
const LEGEND_MAX_GROW = 1.4;
const MIN_STROKE_PX = 1;
/** How far the light and the shadow of the emboss fall, in pixels. */
const EMBOSS_PX = 0.6;

/** Where the characters go: the norm's six cells; an old motorcycle plate's two digits, centred. */
const characterPositions = (
  characters: string[],
  slots: { x: number; y: number }[],
  cell: number
) => {
  if (characters.length === slots.length) return slots;
  const left = slots.slice(0, 3);
  const right = characters.length - 3;
  const gap = slots[1]!.x - slots[0]!.x - cell;
  const spanStart = slots[3]!.x;
  const span = slots[5]!.x + cell - spanStart;
  const used = right * cell + (right - 1) * gap;
  const start = spanStart + (span - used) / 2;
  return [
    ...left,
    ...Array.from({ length: right }, (_, index) => ({
      x: start + index * (cell + gap),
      y: slots[3]!.y,
    })),
  ];
};

/**
 * A vehicle's plate as the Colombian norm draws it (spec 023, HU-01; ficha MT 001): yellow, with the
 * black embossed frame, the six characters traced from the norm's drawings, a discreet circle between
 * letters and digits (RN-03) and, below, the city that issued a car plate or «COLOMBIA» on a
 * motorcycle's. A vector drawing in millimetres, the same at any size. Decorative: assistive
 * technologies read the plate with its hyphen and, for a car, its city (CA-06).
 */
const PlateLabel = ({ plate, city, legend, size = 'md', className = '' }: PlateLabelProps) => {
  const t = useTranslations('vehicles');
  // useId gives characters a url() reference would not accept.
  const filterId = `plate-emboss-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const canonical = normalizePlate(plate);
  const shown = formatPlate(canonical);
  const kind = plateKind(canonical);
  const isCar = kind === 'car';

  const legendText = (isCar ? plateLegend(city, legend) : t('plate.country')) ?? '';
  const set = PLATE_GLYPHS[kind];
  const legendSet = PLATE_GLYPHS[PLATE_SPECS[kind].legend.set];
  const pxPerMm = WIDTH_PX[size] / PLATE_SPECS[kind].size[0];
  const grow = Math.min(
    LEGEND_MAX_GROW,
    Math.max(1, LEGEND_MIN_PX / (legendSet.cell[1] * pxPerMm))
  );
  const layout = plateLayout(kind, legendText, { grow });
  const [width, height] = layout.size;
  const characters = [...canonical];
  const positions = characterPositions(characters, layout.characters, set.cell[0]);
  /** A width in mm never thinner than MIN_STROKE_PX on screen (`scale`: of the group it is in). */
  const atLeastOnePx = (mm: number, scale = 1) => Math.max(mm, MIN_STROKE_PX / (pxPerMm * scale));
  const emboss = EMBOSS_PX / pxPerMm;
  const circleStroke = atLeastOnePx(set.stroke / 4);
  // A thicker frame grows inwards: its outer edge stays where the norm puts it.
  const frameStroke = atLeastOnePx(layout.frame.width);
  const frameGrowth = (frameStroke - layout.frame.width) / 2;
  const frameInset = layout.frame.inset + frameGrowth;

  return (
    // Spec 019, CA-12: `data-plate` gives it the metal and the glint (globals.css); the corners are the
    // norm's radius, in proportion.
    <span
      data-plate
      data-legend={legendText || undefined}
      className={`relative inline-block shrink-0 text-plate-ink ${WIDTH[size]} ${ASPECT[kind]} ${className}`}
      style={{
        borderRadius: `${(layout.radius / width) * 100}% / ${(layout.radius / height) * 100}%`,
      }}
    >
      <span className="sr-only">
        {shown}
        {isCar && city && <span>, {city}</span>}
      </span>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 size-full"
        fill="none"
        stroke="currentColor"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      >
        <defs>
          {/* The emboss: light above and shadow below the raised parts (spec 019, CA-12). */}
          <filter id={filterId} x="-5%" y="-5%" width="110%" height="110%">
            <feOffset in="SourceAlpha" dy={-emboss} result="up" />
            <feFlood floodColor="#ffffff" floodOpacity="0.55" />
            <feComposite in2="up" operator="in" result="light" />
            <feOffset in="SourceAlpha" dy={emboss} result="down" />
            <feFlood floodColor="#000000" floodOpacity="0.3" />
            <feComposite in2="down" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="light" />
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g filter={`url(#${filterId})`}>
          <rect
            x={frameInset}
            y={frameInset}
            width={width - 2 * frameInset}
            height={height - 2 * frameInset}
            rx={Math.max(0, layout.frame.radius - frameGrowth)}
            strokeWidth={frameStroke}
          />
          <g data-characters strokeWidth={set.stroke} strokeMiterlimit={set.miterLimit}>
            {characters.map((character, index) => {
              const path = set.glyphs[character];
              const position = positions[index];
              if (!path || !position) return null;
              return (
                <path key={index} d={path} transform={`translate(${position.x} ${position.y})`} />
              );
            })}
          </g>
          {/* RN-03: a discreet circle where the norm puts the Ministry's logo. */}
          <circle
            cx={layout.circle.cx}
            cy={layout.circle.cy}
            r={layout.circle.r - circleStroke / 2}
            strokeWidth={circleStroke}
          />
        </g>
        {/* The legend's thin letters go without the emboss: its light and shadow would blur them. */}
        {legendText && (
          <g
            data-legend-glyphs
            transform={`translate(${layout.legend.x} ${layout.legend.y}) scale(${layout.legend.scale})`}
            strokeWidth={atLeastOnePx(legendSet.stroke, layout.legend.scale)}
            strokeMiterlimit={legendSet.miterLimit}
          >
            {layout.legend.glyphs.map(({ path, x }, index) =>
              path ? <path key={index} d={path} transform={`translate(${x} 0)`} /> : null
            )}
          </g>
        )}
      </svg>
    </span>
  );
};

export default PlateLabel;
