import { formatPlate } from '@web/modules/vehicles/utils/plate.utils';

type PlateLabelProps = { plate: string; className?: string };

/** A plate as staff read it on the vehicle: uppercase, hyphen after the letters (spec 005, CA-03). */
const PlateLabel = ({ plate, className = '' }: PlateLabelProps) => (
  <span
    className={`inline-flex items-center rounded-small border border-default-300 bg-content1 px-2 py-0.5 font-mono text-sm font-semibold tracking-wider whitespace-nowrap ${className}`}
  >
    {formatPlate(plate)}
  </span>
);

export default PlateLabel;
