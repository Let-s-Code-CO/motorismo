'use client';

import { useTranslations } from 'next-intl';

import { Bike, CarFront, Motorbike } from 'lucide-react';

import type { VehicleView } from '@web/modules/vehicles/api/vehicles.server';
import ColorSwatch from '@web/modules/vehicles/components/atoms/color-swatch.component';
import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';

const ICONS: Record<VehicleType, typeof Bike> = {
  motorcycle: Motorbike,
  bicycle: Bike,
  car: CarFront,
};

type VehicleSummaryProps = { vehicle: VehicleView };

/** "Marca Línea" of a vehicle (the line is optional on a bicycle). */
export const vehicleName = (vehicle: Pick<VehicleView, 'brand' | 'line'>) =>
  [vehicle.brand?.name, vehicle.line?.name].filter(Boolean).join(' ');

/**
 * One vehicle (spec 005): "Marca Línea", the type with its displacement (motorcycle) or its class
 * (car, bicycle), the colour by name with a swatch (CA-16) and the plate drawn like a Colombian one,
 * a car's with its issuing city (CA-03, CA-27), or "Sin placa" for a bicycle (CA-06).
 */
const VehicleSummary = ({ vehicle }: VehicleSummaryProps) => {
  const t = useTranslations('vehicles');
  const Icon = ICONS[vehicle.vehicle_type];
  const kind = vehicle.vehicle_class
    ? t(`classes.${vehicle.vehicle_class}`)
    : t(`types.${vehicle.vehicle_type}`);

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-medium bg-default-100 text-default-600">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{vehicleName(vehicle)}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-default-500">
          <span>{kind}</span>
          {vehicle.displacement_cc !== null && (
            <span>{t('summary.displacement', { value: vehicle.displacement_cc })}</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <ColorSwatch color={vehicle.color} />
            <span>{t(`colors.${vehicle.color}`)}</span>
          </span>
        </span>
      </div>
      {vehicle.plate ? (
        <PlateLabel plate={vehicle.plate} city={vehicle.plate_city?.name} />
      ) : (
        <span className="text-sm whitespace-nowrap text-default-500">{t('summary.noPlate')}</span>
      )}
    </div>
  );
};

export default VehicleSummary;
