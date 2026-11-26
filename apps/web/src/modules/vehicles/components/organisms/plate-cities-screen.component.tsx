'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Button, Input } from '@heroui/react';
import { Pencil, Search } from 'lucide-react';

import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';
import PlateLegendDialog from '@web/modules/vehicles/components/molecules/plate-legend-dialog.component';
import VehicleCatalogTabs from '@web/modules/vehicles/components/molecules/vehicle-catalog-tabs.component';
import { PLATE_SAMPLE } from '@web/modules/vehicles/constants/vehicle-options.constants';
import type { PlateCity } from '@web/modules/vehicles/types/vehicles.types';
import { filterPlateCities, sortPlateCities } from '@web/modules/vehicles/utils/plate-city.utils';

type PlateCitiesScreenProps = { cities: PlateCity[] };

/**
 * «Ciudades de placa», a tab of «Marcas y líneas» (spec 023, HU-03): the municipalities that issue
 * plates (RN-04), in the order of the vehicle form (Bogotá, D.C. first), each with a sample plate as it
 * reads now and whether it has its own legend or uses its name (CA-09). «Cambiar leyenda» opens the
 * dialog (CA-10). The search ignores case and accents.
 */
const PlateCitiesScreen = ({ cities }: PlateCitiesScreenProps) => {
  const t = useTranslations('vehicles.plateCities');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<PlateCity | null>(null);
  const shown = filterPlateCities(sortPlateCities(cities), query);

  return (
    <section className="flex flex-col gap-6">
      <VehicleCatalogTabs current="plateCities" />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-default-500">{t('description')}</p>
      </div>

      <Input
        type="search"
        label={t('searchLabel')}
        labelPlacement="outside"
        placeholder={t('searchPlaceholder')}
        variant="bordered"
        className="max-w-md"
        value={query}
        onValueChange={setQuery}
        startContent={<Search aria-hidden className="size-4 shrink-0 text-default-400" />}
      />
      <p aria-live="polite" className="text-sm text-default-500">
        {t('count', { count: shown.length })}
      </p>

      {shown.length === 0 ? (
        <p className="text-sm text-default-500">{t('noMatch')}</p>
      ) : (
        <ul
          aria-label={t('listLabel')}
          className="flex flex-col divide-y divide-divider rounded-large border border-divider bg-content1 shadow-small"
        >
          {shown.map((city) => (
            <li key={city.code} className="flex flex-wrap items-center gap-4 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <h2 className="truncate font-medium">{city.name}</h2>
                <span className="truncate text-xs text-default-500">
                  {city.department} · {city.plate_legend ? t('ownLegend') : t('usesName')}
                </span>
              </div>
              <PlateLabel plate={PLATE_SAMPLE} city={city.name} legend={city.plate_legend} />
              <Button
                variant="light"
                size="sm"
                startContent={<Pencil aria-hidden className="size-3.5" />}
                onPress={() => setEditing(city)}
              >
                {t('change')}
                <span className="sr-only"> {t('changeFor', { city: city.name })}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing && <PlateLegendDialog city={editing} onClose={() => setEditing(null)} />}
    </section>
  );
};

export default PlateCitiesScreen;
