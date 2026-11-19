import { COLOR_SWATCHES } from '@web/modules/vehicles/constants/vehicle-options.constants';
import type { VehicleColor } from '@web/modules/vehicles/types/vehicles.types';

type ColorSwatchProps = { color: VehicleColor; className?: string };

/**
 * A round sample of a vehicle colour. Decorative: the colour NAME is always written next to it
 * (spec 005, CA-16). A thin ring keeps white, beige or silver visible on a light background.
 */
const ColorSwatch = ({ color, className = 'size-3.5' }: ColorSwatchProps) => (
  <span
    aria-hidden="true"
    data-swatch={color}
    className={`inline-block shrink-0 rounded-full ring-1 ring-black/15 ring-inset dark:ring-white/25 ${className}`}
    style={{ background: COLOR_SWATCHES[color] }}
  />
);

export default ColorSwatch;
