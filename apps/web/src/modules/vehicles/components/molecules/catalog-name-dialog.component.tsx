'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';

import { notify } from '@web/modules/core/lib/toast.lib';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import {
  addVehicleBrand,
  addVehicleLine,
  renameVehicleBrand,
  renameVehicleLine,
} from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import { CATALOG_NAME_MAX } from '@web/modules/vehicles/constants/vehicle-options.constants';
import { catalogNameSchema } from '@web/modules/vehicles/schemas/vehicle-catalog.schema';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import type { VehicleCatalogErrorKey } from '@web/modules/vehicles/utils/vehicle-catalog-errors.utils';

export type CatalogNameTarget =
  | { kind: 'renameBrand' | 'renameLine'; id: string; name: string }
  | { kind: 'addBrand'; type: VehicleType }
  | { kind: 'addLine'; brandId: string; brandName: string };

type CatalogNameDialogProps = { target: CatalogNameTarget; onClose: () => void };

/**
 * The admin writes a name for the catalog (spec 018): a new name for a brand or line (HU-02), or a
 * brand or line that is missing (HU-06, CA-26, CA-27). An empty or too long name is refused by the
 * field (CA-10, CA-28); a name another one has, by the database, inside the dialog (CA-09, CA-28).
 * Saved, a floating notice says it (CA-11).
 */
const CatalogNameDialog = ({ target, onClose }: CatalogNameDialogProps) => {
  const t = useTranslations('vehicles');
  const router = useRouter();
  const isRename = target.kind === 'renameBrand' || target.kind === 'renameLine';
  const [name, setName] = useState(isRename ? target.name : '');
  const [fieldError, setFieldError] = useState<string>();
  const [serverError, setServerError] = useState<VehicleCatalogErrorKey>();
  const [isPending, startTransition] = useTransition();

  const title = () => {
    switch (target.kind) {
      case 'renameBrand':
        return t('catalog.rename.brandTitle', { name: target.name });
      case 'renameLine':
        return t('catalog.rename.lineTitle', { name: target.name });
      case 'addBrand':
        return t('catalog.rename.addBrandTitle', { type: t(`types.${target.type}`).toLowerCase() });
      case 'addLine':
        return t('catalog.rename.addLineTitle', { name: target.brandName });
    }
  };

  // Through callAction: with no network, nothing happens (spec 006, CA-10).
  const save = (value: string) =>
    callAction(() =>
      target.kind === 'addBrand'
        ? addVehicleBrand({ type: target.type, name: value })
        : target.kind === 'addLine'
          ? addVehicleLine({ brandId: target.brandId, name: value })
          : target.kind === 'renameBrand'
            ? renameVehicleBrand({ id: target.id, name: value })
            : renameVehicleLine({ id: target.id, name: value })
    );

  const submit = () => {
    const parsed = catalogNameSchema.safeParse({ name });
    if (!parsed.success) {
      setFieldError(t(`catalog.validation.${parsed.error.issues[0]?.message ?? 'required'}`));
      return;
    }
    startTransition(async () => {
      const result = await save(parsed.data.name);
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      onClose();
      notify({
        tone: 'success',
        text: t(isRename ? 'catalog.rename.saved' : 'catalog.rename.added', {
          name: parsed.data.name,
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
        <ModalHeader>{title()}</ModalHeader>
        <ModalBody>
          <Input
            label={t('catalog.rename.label')}
            labelPlacement="outside"
            placeholder=" "
            variant="bordered"
            value={name}
            onValueChange={(value) => {
              setName(value);
              setFieldError(undefined);
              setServerError(undefined);
            }}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            isInvalid={!!fieldError}
            errorMessage={fieldError}
            maxLength={CATALOG_NAME_MAX + 20}
            autoFocus
          />
        </ModalBody>
        <ModalFooter className="flex-col items-stretch gap-2">
          <div className="flex justify-end gap-2">
            <Button variant="light" onPress={onClose}>
              {t('catalog.rename.cancel')}
            </Button>
            <Button color="primary" className="font-medium" isLoading={isPending} onPress={submit}>
              {t(isRename ? 'catalog.rename.submit' : 'catalog.rename.addSubmit')}
            </Button>
          </div>
          {serverError && (
            <p role="alert" className="text-right text-sm text-danger">
              {t(`catalog.errors.${serverError}`)}
            </p>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CatalogNameDialog;
