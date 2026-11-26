'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

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

import { notify } from '@web/modules/core/lib/toast.lib';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { setVehicleLineCategory } from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import {
  MOTORCYCLE_CATEGORIES,
  type MotorcycleCategory,
} from '@web/modules/vehicles/constants/motorcycle-categories.constants';
import type { VehicleCatalogErrorKey } from '@web/modules/vehicles/utils/vehicle-catalog-errors.utils';

type CatalogCategoryDialogProps = {
  line: { id: string; name: string; category: MotorcycleCategory | null };
  onClose: () => void;
};

/**
 * The admin sets the category of a motorcycle line (spec 024, CA-01): its motorcycles take it unless
 * staff gave one its own (CA-02, CA-03). Saving says so in a floating notice (spec 013); a refusal
 * stays inside. The list is drawn inside the dialog, so screen readers keep it (CLAUDE.md).
 */
const CatalogCategoryDialog = ({ line, onClose }: CatalogCategoryDialogProps) => {
  const t = useTranslations('vehicles');
  const router = useRouter();
  const [category, setCategory] = useState<MotorcycleCategory | null>(line.category);
  const [error, setError] = useState<VehicleCatalogErrorKey>();
  const [isPending, startTransition] = useTransition();
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);

  const save = () =>
    startTransition(async () => {
      if (!category) return;
      setError(undefined);
      const result = await callAction(() => setVehicleLineCategory({ id: line.id, category }));
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify({
        tone: 'success',
        text: t('catalog.categorySaved', {
          name: line.name,
          category: t(`categories.${category}`),
        }),
      });
      router.refresh();
      onClose();
    });

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} scrollBehavior="outside">
      <ModalContent>
        <div ref={setPortal}>
          <ModalHeader>{t('catalog.categoryTitle', { name: line.name })}</ModalHeader>
          <ModalBody className="flex flex-col gap-3">
            <p className="text-sm text-default-500">{t('catalog.categoryText')}</p>
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
            {error && <Alert color="danger" variant="faded" title={t(`catalog.errors.${error}`)} />}
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

export default CatalogCategoryDialog;
