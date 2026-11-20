'use client';

import { useTranslations } from 'next-intl';

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Asks before an action that changes what others see, e.g. disabling a service or an employee
 * (spec 007, CA-12). The confirming button is destructive: solid red with AA contrast (CLAUDE.md).
 */
const ConfirmDialog = ({
  isOpen,
  title,
  description,
  confirmLabel,
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const t = useTranslations('core.confirm');

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onCancel()} placement="center">
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-600">{description}</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onCancel}>
            {t('cancel')}
          </Button>
          <Button
            color="danger"
            className="bg-danger-600 font-medium data-[hover=true]:bg-danger-700 dark:bg-danger-300 dark:data-[hover=true]:bg-danger-200"
            isLoading={isPending}
            onPress={onConfirm}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfirmDialog;
