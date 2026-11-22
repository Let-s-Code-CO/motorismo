'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';

import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { setReservationTolerance } from '@web/modules/reservations/actions/reservations.actions';
import type { ReservationsErrorKey } from '@web/modules/reservations/utils/reservations-errors.utils';

type ToleranceDialogProps = {
  reservationId: string;
  /** Its own tolerance, or null when it follows the general one. */
  own: number | null;
  general: number;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * The admin gives a reservation its own arrival tolerance, from 0 to 60 minutes, or takes it back to
 * the general one (spec 012, CA-24, RN-11).
 */
const ToleranceDialog = ({
  reservationId,
  own,
  general,
  isOpen,
  onClose,
  onSaved,
}: ToleranceDialogProps) => {
  const t = useTranslations('reservations');
  const [useGeneral, setUseGeneral] = useState(own === null);
  const [minutes, setMinutes] = useState(String(own ?? general));
  const [error, setError] = useState<ReservationsErrorKey | 'range'>();
  const [sending, setSending] = useState(false);

  const save = async () => {
    const value = Number(minutes);
    if (!useGeneral && (!/^\d+$/.test(minutes.trim()) || value > 60)) {
      setError('range');
      return;
    }
    setSending(true);
    const result = await callAction(() =>
      setReservationTolerance({ id: reservationId, minutes: useGeneral ? null : value })
    );
    setSending(false);
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) onSaved();
    else setError(result.error);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} scrollBehavior="outside">
      <ModalContent>
        <ModalHeader>{t('toleranceDialog.title')}</ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="text-sm text-default-500">
            {t('toleranceDialog.text', { minutes: general })}
          </p>
          {error && error !== 'range' && (
            <Alert color="danger" variant="faded" title={t(`errors.${error}`)} />
          )}
          <Checkbox isSelected={useGeneral} onValueChange={setUseGeneral}>
            {t('toleranceDialog.useGeneral')}
          </Checkbox>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            label={t('toleranceDialog.minutes')}
            labelPlacement="outside"
            variant="bordered"
            isDisabled={useGeneral}
            value={minutes}
            onValueChange={setMinutes}
            isInvalid={error === 'range'}
            errorMessage={error === 'range' ? t('validation.toleranceRange') : undefined}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('toleranceDialog.back')}
          </Button>
          <Button color="primary" className="font-medium" isLoading={sending} onPress={save}>
            {t('toleranceDialog.save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ToleranceDialog;
