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

import { cancelMyReservation } from '@web/modules/customer-area/actions/customer-area.actions';
import type { CustomerAreaErrorKey } from '@web/modules/customer-area/utils/customer-area-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type CancelMyReservationDialogProps = {
  reservationId: string;
  /** «viernes, 13 de junio, 10:00 a. m. – 11:00 a. m.» */
  slot: string;
  isOpen: boolean;
  onClose: () => void;
  onCancelled: () => void;
};

/**
 * The customer cancels one of their pending reservations, with an optional reason (spec 014, CA-19):
 * the seat goes back to the slot. A refusal stays here (spec 013, CA-08). Destructive, as
 * «Desactivar cliente».
 */
const CancelMyReservationDialog = ({
  reservationId,
  slot,
  isOpen,
  onClose,
  onCancelled,
}: CancelMyReservationDialogProps) => {
  const t = useTranslations('customerArea');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<CustomerAreaErrorKey | 'tooLong'>();
  const [sending, setSending] = useState(false);

  const confirm = async () => {
    if (reason.trim().length > 200) {
      setError('tooLong');
      return;
    }
    setSending(true);
    const result = await callAction(() => cancelMyReservation({ id: reservationId, reason }));
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
          <p className="text-sm text-default-500">{t('cancelDialog.text', { slot })}</p>
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
            {t('cancelDialog.keep')}
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

export default CancelMyReservationDialog;
