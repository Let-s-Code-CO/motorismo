'use client';

import { type ReactNode, useId, useState } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Tooltip,
  useDisclosure,
} from '@heroui/react';
import { Pencil } from 'lucide-react';

import { formatMobile } from '@web/modules/core/utils/phone.utils';
import CustomerForm from '@web/modules/customers/components/organisms/customer-form.component';

type CustomerContactCardProps = {
  customer: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    user_id: string | null;
  };
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs font-medium tracking-wide text-default-500 uppercase">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

/**
 * "Datos de contacto" of a customer record (spec 004, CA-18): email and phone, and — from an icon
 * button in the card's header — the edit form in a dialog (CA-27). A saved change is announced in
 * the card, next to the data it changed.
 */
const CustomerContactCard = ({ customer }: CustomerContactCardProps) => {
  const t = useTranslations('customers');
  const router = useRouter();
  const titleId = useId();
  const { isOpen, onOpen, onClose, onOpenChange } = useDisclosure();
  const [saved, setSaved] = useState(false);

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-large border border-divider bg-content1 p-5 shadow-small"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id={titleId} className="text-sm font-semibold">
          {t('detail.contact')}
        </h2>
        <Tooltip content={t('detail.edit')} placement="left" delay={300} closeDelay={0}>
          <Button
            isIconOnly
            size="sm"
            radius="full"
            variant="light"
            aria-label={t('detail.edit')}
            className="-my-1 -mr-1.5 text-default-500 transition-colors hover:text-foreground"
            onPress={() => {
              setSaved(false);
              onOpen();
            }}
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
        </Tooltip>
      </div>

      {saved && (
        <Alert
          color="success"
          variant="faded"
          title={t('updated')}
          className="mb-4"
          onClose={() => setSaved(false)}
        />
      )}

      <dl className="flex flex-col gap-4">
        <Field label={t('detail.email')}>{customer.email ?? t('detail.none')}</Field>
        <Field label={t('detail.phone')}>
          {customer.phone ? formatMobile(customer.phone) : t('detail.none')}
        </Field>
      </dl>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" backdrop="blur">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-lg font-semibold tracking-tight">{t('detail.edit')}</span>
            <span className="text-sm font-normal text-default-500">
              {t('detail.editDescription')}
            </span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <CustomerForm
              mode="edit"
              customerId={customer.id}
              defaults={customer}
              emailLocked={customer.user_id !== null}
              onCancel={onClose}
              onSaved={() => {
                onClose();
                setSaved(true);
                router.refresh();
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </section>
  );
};

export default CustomerContactCard;
