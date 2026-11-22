'use client';

import { useId, useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { ChevronDown, Plus } from 'lucide-react';

import ConfirmDialog from '@web/modules/core/components/confirm-dialog.component';
import { notify } from '@web/modules/core/lib/toast.lib';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { setServiceDisabled } from '@web/modules/services/actions/services.actions';
import type { ServiceRow } from '@web/modules/services/api/services.server';
import ServiceForm from '@web/modules/services/components/organisms/service-form.component';
import ServicesTable from '@web/modules/services/components/organisms/services-table.component';

type ServicesScreenProps = {
  /** The services this user may read: an admin gets the disabled ones too (RLS). */
  services: ServiceRow[];
  /** Only an admin changes the catalog (RN-01); the database decides, this only hides buttons. */
  isAdmin: boolean;
};

type Editing = { mode: 'new' } | { mode: 'edit'; service: ServiceRow } | null;

/**
 * «Servicios» (spec 007, HU-01, HU-03, HU-04): the active services, and apart the disabled ones
 * with their date (CA-12, CA-13). An admin registers, corrects, disables (asking first) and
 * reactivates; an operator only reads (CA-15).
 */
const ServicesScreen = ({ services, isAdmin }: ServicesScreenProps) => {
  const t = useTranslations('services');
  const router = useRouter();
  const disabledId = useId();
  const [editing, setEditing] = useState<Editing>(null);
  const [disabling, setDisabling] = useState<ServiceRow | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = services.filter((service) => service.disabled_at === null);
  const disabled = services.filter((service) => service.disabled_at !== null);

  const toggle = (service: ServiceRow, disable: boolean) =>
    startTransition(async () => {
      const result = await callAction(() =>
        setServiceDisabled({ id: service.id, disabled: disable })
      );
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      setDisabling(null);
      // Spec 013: a floating notice, where it is seen; a refusal stays until closed (CA-07).
      notify(
        result.ok
          ? { tone: 'success', text: disable ? t('disabledNotice') : t('reactivated') }
          : { tone: 'danger', text: t(`errors.${result.error}`) }
      );
      router.refresh();
    });

  const adminActions = isAdmin
    ? {
        onEdit: (service: ServiceRow) => {
          setEditing({ mode: 'edit', service });
        },
        onDisable: (service: ServiceRow) => {
          setDisabling(service);
        },
      }
    : {};

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-default-500">{t('description')}</p>
        </div>
        {isAdmin && (
          <Button
            color="primary"
            className="font-medium"
            startContent={<Plus aria-hidden className="size-4" />}
            onPress={() => {
              setEditing({ mode: 'new' });
            }}
          >
            {t('new')}
          </Button>
        )}
      </div>

      <ServicesTable
        services={active}
        variant="active"
        label={t('table.label')}
        emptyLabel={isAdmin ? t('empty') : t('emptyReadOnly')}
        isBusy={isPending}
        {...adminActions}
      />

      {isAdmin && disabled.length > 0 && (
        <div className="flex flex-col gap-3">
          <Button
            variant="light"
            size="sm"
            className="w-max text-default-600"
            aria-expanded={showDisabled}
            aria-controls={disabledId}
            endContent={
              <ChevronDown
                aria-hidden
                className={`size-4 transition-transform ${showDisabled ? 'rotate-180' : ''}`}
              />
            }
            onPress={() => setShowDisabled((shown) => !shown)}
          >
            {t('disabledTitle', { count: disabled.length })}
          </Button>
          {showDisabled && (
            <div id={disabledId}>
              <ServicesTable
                services={disabled}
                variant="disabled"
                label={t('table.disabledLabel')}
                isBusy={isPending}
                onReactivate={(service) => {
                  toggle(service, false);
                }}
              />
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        size="lg"
        scrollBehavior="outside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>
                {editing?.mode === 'edit' ? t('form.titleEdit') : t('form.titleNew')}
              </ModalHeader>
              <ModalBody className="pb-6">
                <ServiceForm
                  service={editing?.mode === 'edit' ? editing.service : undefined}
                  onCancel={onClose}
                  onSaved={() => {
                    const wasEditing = editing?.mode === 'edit';
                    onClose();
                    notify({ tone: 'success', text: wasEditing ? t('updated') : t('created') });
                    router.refresh();
                  }}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      <ConfirmDialog
        isOpen={disabling !== null}
        title={t('confirmDisable.title', { name: disabling?.name ?? '' })}
        description={t('confirmDisable.description')}
        confirmLabel={t('confirmDisable.confirm')}
        isPending={isPending}
        onCancel={() => setDisabling(null)}
        onConfirm={() => disabling && toggle(disabling, true)}
      />
    </section>
  );
};

export default ServicesScreen;
