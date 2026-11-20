import { formatPlate } from '@web/modules/vehicles/utils/plate.utils';

/** «Suzuki GSX-R600 · UIH-03D», or the plate placeholder for a bicycle (spec 008). */
export const vehicleLabel = (
  vehicle: { brand_name: string | null; line_name: string | null; plate: string | null },
  noPlate: string
) =>
  `${[vehicle.brand_name, vehicle.line_name].filter(Boolean).join(' ')} · ${
    vehicle.plate ? formatPlate(vehicle.plate) : noPlate
  }`;
