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
      <span data-plate className={`${PLATE} ${RIM_SM} px-1.5 py-[3px] text-[11px] ${className}`}>
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
    <span
      data-plate
      className={`${PLATE} ${RIM_MD} min-w-[5.25rem] px-3 pt-[5px] pb-1 ${className}`}
    >
      {readable !== shown && <span className="sr-only">{readable}</span>}
      <Screws />
      <span aria-hidden={readable !== shown || undefined} className={`${CHARACTERS} text-[15px]`}>
        {shown}
      </span>
      {below && (
        // Taller line than SMALL_PRINT: truncate clips, and the accent of BOGOTÁ sits above.
        <span
          aria-hidden="true"
          className={`${SMALL_PRINT} mt-[2px] max-w-[6.5rem] truncate !leading-[1.35]`}
        >
          {below}
        </span>
      )}
    </span>
  );
};

export default PlateLabel;
