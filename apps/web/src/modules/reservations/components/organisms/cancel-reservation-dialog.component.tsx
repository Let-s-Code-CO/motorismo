'use client';

import { useState } from 'react';

import { useTranslations } from 'next-intl';

import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@heroui/react';

import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { cancelReservation } from '@web/modules/reservations/actions/reservations.actions';
import type { ReservationsErrorKey } from '@web/modules/reservations/utils/reservations-errors.utils';

type CancelReservationDialogProps = {
  reservationId: string;
  isOpen: boolean;
  onClose: () => void;
  onCancelled: () => void;
};

/**
 * Cancels a pending reservation, with an optional reason (spec 012, CA-21): its slot gets the seat
 * back, and it stays in the agenda, marked. A destructive action, as «Desactivar cliente».
 */
const CancelReservationDialog = ({
  reservationId,
  isOpen,
  onClose,
  onCancelled,
}: CancelReservationDialogProps) => {
  const t = useTranslations('reservations');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ReservationsErrorKey | 'tooLong'>();
  const [sending, setSending] = useState(false);

  const confirm = async () => {
    if (reason.trim().length > 200) {
      setError('tooLong');
      return;
    }
    setSending(true);
    const result = await callAction(() => cancelReservation({ id: reservationId, reason }));
    setSending(false);
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) onCancelled();
    else setError(result.error);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} scrollBehavior="outside">
      <ModalContent>
        <ModalHeader>{t('cancelDialog.title')}</ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="text-sm text-default-500">{t('cancelDialog.text')}</p>
          {error && error !== 'tooLong' && (
            <Alert color="danger" variant="faded" title={t(`errors.${error}`)} />
          )}
          <Textarea
            label={t('cancelDialog.reason')}
            labelPlacement="outside"
            variant="bordered"
            minRows={2}
            value={reason}
            onValueChange={setReason}
            isInvalid={error === 'tooLong'}
            errorMessage={error === 'tooLong' ? t('validation.reasonTooLong') : undefined}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            {t('cancelDialog.back')}
          </Button>
          <Button
            color="danger"
            className="bg-danger-600 font-medium text-white dark:bg-danger-300"
            isLoading={sending}
            onPress={confirm}
          >
            {t('cancelDialog.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CancelReservationDialog;
