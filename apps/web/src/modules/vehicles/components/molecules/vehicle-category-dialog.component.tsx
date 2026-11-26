'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';

import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from '@heroui/react';

import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { setVehicleCategory } from '@web/modules/vehicles/actions/vehicles.actions';
import {
  MOTORCYCLE_CATEGORIES,
  type MotorcycleCategory,
} from '@web/modules/vehicles/constants/motorcycle-categories.constants';
import type { VehiclesErrorKey } from '@web/modules/vehicles/utils/vehicles-errors.utils';

type VehicleCategoryDialogProps = {
  vehicleId: string;
  /** Told the category once it is kept on the motorcycle. */
  onSaved: (category: MotorcycleCategory) => void;
  onClose: () => void;
};

/**
 * A motorcycle without category, in an order (spec 024, CA-06): staff choose its category before a
 * service valued by category is added, and it is kept on the motorcycle. A refusal stays inside.
 */
const VehicleCategoryDialog = ({ vehicleId, onSaved, onClose }: VehicleCategoryDialogProps) => {
  const t = useTranslations('vehicles');
  const [category, setCategory] = useState<MotorcycleCategory | null>(null);
  const [error, setError] = useState<VehiclesErrorKey>();
  const [isPending, startTransition] = useTransition();
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);

  const save = () =>
    startTransition(async () => {
      if (!category) return;
      setError(undefined);
      const result = await callAction(() =>
        setVehicleCategory({ vehicle_id: vehicleId, category })
      );
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(category);
    });

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} scrollBehavior="outside">
      <ModalContent>
        <div ref={setPortal}>
          <ModalHeader>{t('categoryDialog.title')}</ModalHeader>
          <ModalBody className="flex flex-col gap-3">
            <p className="text-sm text-default-500">{t('categoryDialog.text')}</p>
            <Select
              label={t('form.category')}
              labelPlacement="outside"
              variant="bordered"
              placeholder={t('form.categoryPlaceholder')}
              selectedKeys={category ? [category] : []}
              onSelectionChange={(keys) => {
                const [key] = Array.from(keys);
                if (key) setCategory(key as MotorcycleCategory);
              }}
              popoverProps={{ portalContainer: portal ?? undefined }}
            >
              {MOTORCYCLE_CATEGORIES.map((option) => (
                <SelectItem key={option}>{t(`categories.${option}`)}</SelectItem>
              ))}
            </Select>
            {error && <Alert color="danger" variant="faded" title={t(`errors.${error}`)} />}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              {t('form.cancel')}
            </Button>
            <Button
              color="primary"
              className="font-medium"
              isLoading={isPending}
              isDisabled={!category}
              onPress={save}
            >
              {t('form.save')}
            </Button>
          </ModalFooter>
        </div>
      </ModalContent>
    </Modal>
  );
};

export default VehicleCategoryDialog;
