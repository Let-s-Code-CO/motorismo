'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';

import { notify } from '@web/modules/core/lib/toast.lib';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import {
  mergeVehicleBrands,
  mergeVehicleLines,
  moveVehicleLine,
} from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import type { CatalogBrand, CatalogLine } from '@web/modules/vehicles/types/vehicle-catalog.types';
import { catalogKey } from '@web/modules/vehicles/utils/catalog-key.utils';
import type { VehicleCatalogErrorKey } from '@web/modules/vehicles/utils/vehicle-catalog-errors.utils';

export type CatalogMergeTarget =
  | { kind: 'mergeBrand'; brand: CatalogBrand }
  | { kind: 'mergeLine' | 'moveLine'; brand: CatalogBrand; line: CatalogLine };

type CatalogMergeDialogProps = {
  target: CatalogMergeTarget;
  /** Every brand of the type, with their lines: the choices come from here. */
  brands: CatalogBrand[];
  onClose: () => void;
};

const FIELD = {
  mergeBrand: 'brandTarget',
  mergeLine: 'lineTarget',
  moveLine: 'moveTarget',
} as const;
const TITLE = { mergeBrand: 'brandTitle', mergeLine: 'lineTitle', moveLine: 'moveTitle' } as const;

/**
 * Merges a brand or a line with the one that stays, or moves a line to another brand (spec 018,
 * HU-03 and HU-04). The choices are only the other brands of the type, or the other lines of the
 * brand (CA-15, CA-20). Before doing it, it says what happens: how many vehicles pass, whether a
 * moved line merges with an equal one there (CA-19), and that it cannot be undone (RN-03).
 */
const CatalogMergeDialog = ({ target, brands, onClose }: CatalogMergeDialogProps) => {
  const t = useTranslations('vehicles.catalog');
  const router = useRouter();
  const [chosen, setChosen] = useState<string | null>(null);
  const [serverError, setServerError] = useState<VehicleCatalogErrorKey>();
  const [isPending, startTransition] = useTransition();
  const [portal, setPortal] = useState<HTMLElement | null>(null);

  const source = target.kind === 'mergeBrand' ? target.brand : target.line;
  const choices =
    target.kind === 'mergeLine'
      ? target.brand.lines.filter((line) => line.id !== target.line.id)
      : brands.filter((brand) => brand.id !== target.brand.id);
  const choice = choices.find((item) => item.id === chosen);
  // CA-19: the line of the brand chosen that IS the moved one, written any way.
  const equalLine =
    target.kind === 'moveLine' && choice
      ? (choice as CatalogBrand).lines.find(
          (line) => catalogKey(line.name) === catalogKey(source.name)
        )
      : undefined;

  const effect = () => {
    if (!choice) return null;
    const values = { count: source.vehicles, target: choice.name, name: source.name };
    if (target.kind === 'mergeBrand') return t('merge.brandEffect', values);
    if (target.kind === 'mergeLine') return t('merge.lineEffect', values);
    return t('merge.moveEffect', values);
  };

  const submit = () => {
    if (!choice) return;
    startTransition(async () => {
      const result = await callAction(() =>
        target.kind === 'mergeBrand'
          ? mergeVehicleBrands({ from: source.id, into: choice.id })
          : target.kind === 'mergeLine'
            ? mergeVehicleLines({ from: source.id, into: choice.id })
            : moveVehicleLine({ lineId: source.id, brandId: choice.id })
      );
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      onClose();
      notify({
        tone: 'success',
        text: t(target.kind === 'moveLine' ? 'merge.moved' : 'merge.merged', {
          name: source.name,
          target: choice.name,
        }),
      });
      router.refresh();
    });
  };

  return (
    <Modal
      isOpen
      onOpenChange={(isOpen) => !isOpen && onClose()}
      placement="center"
      scrollBehavior="outside"
    >
      <ModalContent>
        <div ref={setPortal}>
          <ModalHeader>{t(`merge.${TITLE[target.kind]}`, { name: source.name })}</ModalHeader>
          <ModalBody className="gap-4">
            <Autocomplete
              label={t(`merge.${FIELD[target.kind]}`)}
              labelPlacement="outside"
              placeholder={t('merge.placeholder')}
              variant="bordered"
              // No clear (×) button: it has no accessible name in HeroUI; the text is erased as usual.
              isClearable={false}
              menuTrigger="focus"
              selectedKey={chosen}
              onSelectionChange={(key) => {
                setChosen(key === null ? null : String(key));
                setServerError(undefined);
              }}
              listboxProps={{ emptyContent: t('merge.noOptions') }}
              // Inside the dialog, or the dialog hides the list from screen readers (CLAUDE.md).
              popoverProps={{ portalContainer: portal ?? undefined }}
            >
              {choices.map((item) => (
                <AutocompleteItem key={item.id}>{item.name}</AutocompleteItem>
              ))}
            </Autocomplete>
            {choice && (
              <div aria-live="polite" className="flex flex-col gap-1 text-sm text-default-600">
                <p>{effect()}</p>
                {equalLine && (
                  <p>{t('merge.moveJoins', { line: equalLine.name, target: choice.name })}</p>
                )}
                <p className="font-medium text-foreground">{t('merge.final')}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex-col items-stretch gap-2">
            <div className="flex justify-end gap-2">
              <Button variant="light" onPress={onClose}>
                {t('merge.cancel')}
              </Button>
              <Button
                color="primary"
                className="font-medium"
                isDisabled={!choice}
                isLoading={isPending}
                onPress={submit}
              >
                {t(target.kind === 'moveLine' ? 'merge.moveSubmit' : 'merge.mergeSubmit')}
              </Button>
            </div>
            {serverError && (
              <p role="alert" className="text-right text-sm text-danger">
                {t(`errors.${serverError}`)}
              </p>
            )}
          </ModalFooter>
        </div>
      </ModalContent>
    </Modal>
  );
};

export default CatalogMergeDialog;
