'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import { Autocomplete, AutocompleteItem } from '@heroui/react';

import { MAX_PLATE_CITY_OPTIONS } from '@web/modules/vehicles/constants/vehicle-options.constants';
import type { Municipality } from '@web/modules/vehicles/types/vehicles.types';
import { filterPlateCities } from '@web/modules/vehicles/utils/plate-city.utils';

type PlateCityAutocompleteProps = {
  /** DANE code of the chosen city, or null. */
  value: string | null | undefined;
  onChange: (code: string | null) => void;
  onBlur?: () => void;
  /** The municipalities, already in the order of the form (sortPlateCities). */
  cities: Municipality[];
  isLoading?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  /** Where the list is drawn; inside a modal, an element of the modal (see CatalogAutocomplete). */
  portalContainer?: HTMLElement;
};

/**
 * The city that issued a car plate (spec 005, HU-07, CA-30): only municipalities of the list (no
 * free text, RF-07), filtered while typing without caring about case or accents; each option shows
 * its department on the same line, which tells homonyms apart. Erasing the text leaves the car
 * without a city, so the form can say it is missing (CA-07). Of the 1,104 cities it lists at most
 * 50 at a time (the three most common first) and asks to type for the rest.
 */
const PlateCityAutocomplete = ({
  value,
  onChange,
  onBlur,
  cities,
  isLoading,
  isInvalid,
  errorMessage,
  portalContainer,
}: PlateCityAutocompleteProps) => {
  const t = useTranslations('vehicles');
  // What the user is typing; null while the field just shows the chosen city.
  const [query, setQuery] = useState<string | null>(null);
  const chosen = cities.find((city) => city.code === value);
  const matches = filterPlateCities(cities, query ?? '');
  const shown = matches.slice(0, MAX_PLATE_CITY_OPTIONS);
  // The chosen city must be among the options, or the field loses it when it closes: without a
  // filter, one beyond the first 50 (e.g. Medellín) goes first.
  const options =
    query === null && chosen && !shown.includes(chosen)
      ? [chosen, ...shown.slice(0, MAX_PLATE_CITY_OPTIONS - 1)]
      : shown;

  return (
    <Autocomplete
      label={t('form.plateCity')}
      placeholder={t('form.plateCityPlaceholder')}
      labelPlacement="outside"
      variant="bordered"
      validationBehavior="aria"
      // No clear (×) button: it has no accessible name in HeroUI; the text is erased as usual.
      isClearable={false}
      menuTrigger="focus"
      items={options}
      isVirtualized={false}
      // The list scrolls while focus stays in the field: its scrolling region must be focusable to
      // be reachable (axe: scrollable-region-focusable). It never gets in the way of Tab: the list
      // is drawn at the top of the form and closes as soon as the field loses focus.
      scrollShadowProps={{ tabIndex: 0 }}
      inputValue={query ?? chosen?.name ?? ''}
      onInputChange={(text) => {
        // React Aria also reports the chosen name back: that is not typing.
        if (query === null && text === (chosen?.name ?? '')) return;
        setQuery(text);
        if (text.trim() === '') onChange(null);
      }}
      selectedKey={value ?? null}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
        setQuery(null);
      }}
      onBlur={() => {
        setQuery(null);
        onBlur?.();
      }}
      isLoading={isLoading}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      // The list is drawn inside the form (portalContainer): without padding against that
      // container, a field in the left column would get its list shifted 12 px to the right.
      popoverProps={{ portalContainer, containerPadding: 0 }}
      listboxProps={{
        emptyContent: t('form.noCityMatches'),
        bottomContent:
          matches.length > MAX_PLATE_CITY_OPTIONS ? (
            <p className="px-2 pt-1 pb-1.5 text-tiny text-default-500">
              {t('form.typeForMoreCities')}
            </p>
          ) : null,
      }}
    >
      {(city) => (
        // One line: the name, and its department on
        // the right, muted — it tells homonyms apart. Not repeated when it is the name itself
        // (Bogotá, D.C.). Muted (default-500, AA on white); default-600 on the highlighted row,
        // whose darker background would otherwise cost the contrast.
        <AutocompleteItem key={city.code} textValue={city.name}>
          <span className="flex w-full min-w-0 items-baseline justify-between gap-3">
            <span className="truncate">{city.name}</span>
            {city.department !== city.name && (
              <span className="max-w-[55%] shrink-0 truncate text-tiny text-default-500 group-data-[focus=true]:text-default-600 group-data-[hover=true]:text-default-600">
                {city.department}
              </span>
            )}
          </span>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
};

export default PlateCityAutocomplete;
