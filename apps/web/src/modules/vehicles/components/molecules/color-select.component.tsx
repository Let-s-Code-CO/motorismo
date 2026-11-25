'use client';

import { useTranslations } from 'next-intl';

import { Select, SelectItem } from '@heroui/react';

import ColorSwatch from '@web/modules/vehicles/components/atoms/color-swatch.component';
import { VEHICLE_COLORS } from '@web/modules/vehicles/constants/vehicle-options.constants';
import type { VehicleColor } from '@web/modules/vehicles/types/vehicles.types';

type ColorSelectProps = {
  value: VehicleColor | null | undefined;
  onChange: (color: VehicleColor) => void;
  onBlur?: () => void;
  isInvalid?: boolean;
  errorMessage?: string;
  /** Where the list is drawn; inside a modal, an element of the modal (see CatalogAutocomplete). */
  portalContainer?: HTMLElement;
};

/**
 * The colour of a vehicle, chosen from the list of the spec (spec 005, CA-15 / RN-05): each option
 * shows its name and a swatch ("Multicolor" a swatch of several colours). Keyboard-operable.
 */
const ColorSelect = ({
  value,
  onChange,
  onBlur,
  isInvalid,
  errorMessage,
  portalContainer,
}: ColorSelectProps) => {
  const t = useTranslations('vehicles');

  return (
    <Select
      label={t('form.color')}
      placeholder={t('form.colorPlaceholder')}
      labelPlacement="outside"
      variant="bordered"
      validationBehavior="aria"
      selectedKeys={value ? [value] : []}
      onSelectionChange={(keys) => {
        const [key] = Array.from(keys);
        if (key) onChange(key as VehicleColor);
      }}
      onClose={onBlur}
      // The list is drawn inside the form (portalContainer): without padding against that
      // container, a field in the left column would get its list shifted 12 px to the right.
      // It stays open when its container scrolls: in a modal taller than the screen (a new customer
      // with their first vehicle, spec 022; a vehicle on a phone), opening it moves the focus to its
      // options, the modal scrolls to show them, and HeroUI's default would close it at once.
      popoverProps={{ portalContainer, containerPadding: 0, shouldCloseOnScroll: false }}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      renderValue={(items) =>
        items.map((item) => (
          <span key={item.key} className="flex items-center gap-2">
            <ColorSwatch color={item.key as VehicleColor} />
            {item.textValue}
          </span>
        ))
      }
    >
      {VEHICLE_COLORS.map((color) => (
        <SelectItem
          key={color}
          textValue={t(`colors.${color}`)}
          startContent={<ColorSwatch color={color} className="size-4" />}
        >
          {t(`colors.${color}`)}
        </SelectItem>
      ))}
    </Select>
  );
};

export default ColorSelect;
