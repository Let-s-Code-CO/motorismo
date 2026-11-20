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
import { voidWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import type { WorkOrdersErrorKey } from '@web/modules/work-orders/utils/work-orders-errors.utils';

type VoidOrderDialogProps = {
  orderId: string;
  number: number;
  isOpen: boolean;
  onCancel: () => void;
  onVoided: () => void;
};

/**
 * Voiding an order, always with a reason (spec 008, CA-21, CA-23): it is kept, marked, and stops
 * counting. Destructive: a solid red button (CLAUDE.md). The database decides who may void a
 * closed order (RN-05).
 */
const VoidOrderDialog = ({ orderId, number, isOpen, onCancel, onVoided }: VoidOrderDialogProps) => {
  const t = useTranslations('orders');
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  const [serverError, setServerError] = useState<WorkOrdersErrorKey>();
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setServerError(undefined);
    if (!reason.trim()) {
      setMissing(true);
      return;
    }
    setPending(true);
    const result = await callAction(() => voidWorkOrder({ id: orderId, reason }));
    setPending(false);
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) onVoided();
    else setServerError(result.error);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onCancel()} placement="center">
      <ModalContent>
        <ModalHeader>{t('void.title', { number })}</ModalHeader>
        <ModalBody className="gap-4">
          {serverError && (
            <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />
          )}
          <p className="text-sm text-default-600">{t('void.description')}</p>
          <Textarea
            label={t('void.reason')}
            placeholder={t('void.reasonPlaceholder')}
            labelPlacement="outside"
            variant="bordered"
            minRows={2}
            value={reason}
            onValueChange={(value) => {
              setReason(value);
              setMissing(false);
            }}
            validationBehavior="aria"
            isInvalid={missing}
            errorMessage={missing ? t('validation.reasonRequired') : undefined}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onCancel}>
            {t('void.cancel')}
          </Button>
          <Button
            color="danger"
            className="bg-danger-600 font-medium data-[hover=true]:bg-danger-700"
            isLoading={pending}
            onPress={confirm}
          >
            {t('void.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default VoidOrderDialog;
