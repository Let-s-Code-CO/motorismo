'use client';

import { useTranslations } from 'next-intl';

import { Autocomplete, AutocompleteItem } from '@heroui/react';

import type { CatalogItem } from '@web/modules/vehicles/types/vehicles.types';
import { filterCatalog, findInCatalog } from '@web/modules/vehicles/utils/catalog-key.utils';

type CatalogAutocompleteProps = {
  label: string;
  placeholder: string;
  items: CatalogItem[];
  value: string;
  onChange: (name: string) => void;
  onBlur?: () => void;
  isLoading?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  /**
   * Where the suggestions are drawn. Inside a modal, pass an element of the modal: the modal hides
   * everything outside it from assistive technologies (aria-hidden), suggestions included.
   */
  portalContainer?: HTMLElement;
};

/**
 * A brand or a line (spec 005, HU-02): suggests the catalog entries that contain what is typed
 * (ignoring case, accents, spaces and hyphens: CA-10, CA-12) and accepts a new name, which joins
 * the catalog when the vehicle is saved (CA-13) — the field says so.
 */
const CatalogAutocomplete = ({
  label,
  placeholder,
  items,
  value,
  onChange,
  onBlur,
  isLoading,
  isInvalid,
  errorMessage,
  portalContainer,
}: CatalogAutocompleteProps) => {
  const t = useTranslations('vehicles');
  const isNew = value.trim() !== '' && !isLoading && !findInCatalog(items, value);

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder}
      labelPlacement="outside"
      variant="bordered"
      validationBehavior="aria"
      allowsCustomValue
      // No clear (×) button: it has no accessible name in HeroUI; the text is erased as usual.
      isClearable={false}
      menuTrigger="focus"
      items={filterCatalog(items, value)}
      inputValue={value}
      onInputChange={onChange}
      onSelectionChange={(key) => {
        const item = items.find((candidate) => candidate.id === key);
        if (item) onChange(item.name);
      }}
      onBlur={onBlur}
      isLoading={isLoading}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      description={isNew ? t('form.newName') : undefined}
      listboxProps={{ emptyContent: t('form.noSuggestions') }}
      popoverProps={{ portalContainer }}
    >
      {(item) => <AutocompleteItem key={item.id}>{item.name}</AutocompleteItem>}
    </Autocomplete>
  );
};

export default CatalogAutocomplete;
