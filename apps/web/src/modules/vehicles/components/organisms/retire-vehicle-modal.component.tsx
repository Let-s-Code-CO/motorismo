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
} from '@heroui/react';

import { retireVehicle } from '@web/modules/vehicles/actions/vehicles.actions';
import type { VehiclesAudience } from '@web/modules/vehicles/types/vehicles.types';
import type { VehiclesErrorKey } from '@web/modules/vehicles/utils/vehicles-errors.utils';

type RetireVehicleModalProps = {
  /** The vehicle to retire (id and its "Marca Línea"), or null when closed. */
  vehicle: { id: string; name: string } | null;
  audience: VehiclesAudience;
  onClose: () => void;
  onRetired: () => void;
};

/**
 * Confirms the retirement of a vehicle (spec 005, CA-21 / CA-24): it leaves the active vehicles,
 * its plate is freed and it cannot be undone (CA-22, RN-07) — the dialog says so before acting.
 */
const RetireVehicleModal = ({ vehicle, audience, onClose, onRetired }: RetireVehicleModalProps) => {
  const t = useTranslations('vehicles');
  const [error, setError] = useState<VehiclesErrorKey>();
  const [isPending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      if (!vehicle) return;
      const result = await retireVehicle({ id: vehicle.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onRetired();
    });

  return (
    <Modal
      isOpen={vehicle !== null}
      onOpenChange={(open) => {
        if (!open) {
          setError(undefined);
          onClose();
        }
      }}
      placement="center"
    >
      <ModalContent>
        <ModalHeader>{t('retire.title')}</ModalHeader>
        <ModalBody className="gap-4">
          {error && <Alert color="danger" variant="faded" title={t(`errors.${error}`)} />}
          <p className="text-sm text-default-600">
            {t(audience === 'customer' ? 'retire.textOwn' : 'retire.text', {
              vehicle: vehicle?.name ?? '',
            })}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('retire.cancel')}
          </Button>
          <Button color="primary" className="font-medium" isLoading={isPending} onPress={confirm}>
            {t('retire.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default RetireVehicleModal;
