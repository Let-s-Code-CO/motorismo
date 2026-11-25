import { useTranslations } from 'next-intl';

import { formatPlate, normalizePlate } from '@web/modules/vehicles/utils/plate.utils';

type PlateLabelProps = {
  plate: string;
  /** The city that issued a car plate (spec 005, RN-11); motorcycles show "COLOMBIA" instead. */
  city?: string | null;
  /** `sm`: one compact line for tables (CA-29). */
  size?: 'md' | 'sm';
  className?: string;
};

/** Car plates (ABC123) carry their issuing city; motorcycle plates (ABC12D, ABC12) say COLOMBIA. */
const CAR_PLATE = /^[A-Z]{3}\d{3}$/;

/** Yellow reflective plate with the black embossed rim a little inside its edge. */
const PLATE =
  'relative inline-flex shrink-0 flex-col items-center justify-center whitespace-nowrap ' +
  'bg-[linear-gradient(180deg,var(--color-plate-light),var(--color-plate)_60%)] text-plate-ink';
const RIM_MD =
  'rounded-[6px] shadow-[inset_0_0_0_2px_var(--color-plate),inset_0_0_0_3px_var(--color-plate-ink),0_0_0_0.5px_var(--color-plate-edge),0_1px_2px_rgb(0_0_0/0.18)]';
const RIM_SM =
  'rounded-[4px] shadow-[inset_0_0_0_1px_var(--color-plate),inset_0_0_0_1.75px_var(--color-plate-ink),0_0_0_0.5px_var(--color-plate-edge)]';
const CHARACTERS = 'font-bold leading-none tracking-[0.06em] tabular-figures';
const SMALL_PRINT = 'text-[6.5px] leading-none font-semibold tracking-[0.14em]';

/*
 * Every plate has the same width, whatever its letters, so a list of plates lines up: the widest
 * plate there can be (WMW-88W) measures 90 px of characters at 15 px (11 px when small), plus its
 * side padding. 116 px and 80 px hold it with a little room.
 */
const WIDTH_MD = 'w-[7.25rem]';
const WIDTH_SM = 'w-[5rem]';
/** Room for the city under the characters: the width less the side padding (2 × 12 px). */
const CITY_ROOM_PX = 92;
/** How wide one letter of the small print is, with its spacing (measured: 26 letters, 128 px). */
const CITY_LETTER_PX = 4.94;
const CITY_FONT_PX = 6.5;

/**
 * The small print's size for a city: the plate's own, or smaller for a long name so it fits whole
 * («SAN ANTONIO DEL TEQUENDAMA»), never cut. Undefined keeps the class size.
 */
const cityFontSize = (city: string) => {
  const needed = city.length * CITY_LETTER_PX;
  return needed > CITY_ROOM_PX
    ? `${((CITY_FONT_PX * CITY_ROOM_PX) / needed).toFixed(2)}px`
    : undefined;
};

/** The two mounting screws of the plate, decorative. */
const Screws = () => (
  <>
    <span className="absolute top-1/2 left-[5px] size-[3px] -translate-y-1/2 rounded-full bg-plate-ink/20" />
    <span className="absolute top-1/2 right-[5px] size-[3px] -translate-y-1/2 rounded-full bg-plate-ink/20" />
  </>
);

/**
 * A vehicle's plate drawn like a Colombian private plate (spec 005, HU-07): the characters in one
 * row with a hyphen, and below them the city that issued a car plate or "COLOMBIA" on a
 * motorcycle's (CA-27); one compact line in tables (CA-29). The drawing is decorative: assistive
 * technologies read the plate with its hyphen and, for a car, its city (CA-28).
 */
const PlateLabel = ({ plate, city, size = 'md', className = '' }: PlateLabelProps) => {
  const t = useTranslations('vehicles');
  const canonical = normalizePlate(plate);
  const shown = formatPlate(canonical);

  if (size === 'sm') {
    return (
      <span
        data-plate
        className={`${PLATE} ${RIM_SM} ${WIDTH_SM} px-1.5 py-[3px] text-[11px] ${className}`}
      >
        <span className={CHARACTERS}>{shown}</span>
      </span>
    );
  }

  // Car and motorcycle look the same: the characters in one row and, below, the city that issued
  // a car plate or "COLOMBIA" on a motorcycle's.
  const isCar = CAR_PLATE.test(canonical);
  const below = isCar ? city?.toLocaleUpperCase('es-CO') : t('plate.country');
  // What assistive technologies read: the plate and a car's city; COLOMBIA is decoration.
  const readable = isCar && city ? `${shown}, ${city}` : shown;

  return (
    // Spec 019, CA-12: `data-plate` gives it the metal look (globals.css).
    <span data-plate className={`${PLATE} ${RIM_MD} ${WIDTH_MD} px-3 pt-[5px] pb-1 ${className}`}>
      {readable !== shown && <span className="sr-only">{readable}</span>}
      <Screws />
      <span aria-hidden={readable !== shown || undefined} className={`${CHARACTERS} text-[15px]`}>
        {shown}
      </span>
      {below && (
        // Taller line than SMALL_PRINT: the accent of BOGOTÁ sits above. A long name is never cut:
        // its print shrinks to fit the plate's width.
        <span
          aria-hidden="true"
          className={`${SMALL_PRINT} mt-[2px] !leading-[1.35]`}
          style={{ fontSize: cityFontSize(below) }}
        >
          {below}
        </span>
      )}
    </span>
  );
};

export default PlateLabel;
