'use client';

import { useId, useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button, Modal, ModalBody, ModalContent, ModalHeader } from '@heroui/react';
import { ChevronDown, UserPlus } from 'lucide-react';

import ConfirmDialog from '@web/modules/core/components/confirm-dialog.component';
import { notify } from '@web/modules/core/lib/toast.lib';
import { setEmployeeDisabled } from '@web/modules/employees/actions/employees.actions';
import type { EmployeeRow } from '@web/modules/employees/api/employees.server';
import EmployeeForm from '@web/modules/employees/components/organisms/employee-form.component';
import EmployeesTable from '@web/modules/employees/components/organisms/employees-table.component';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type EmployeesScreenProps = {
  /** The employees this user may read: an admin gets the disabled ones and the details (RLS). */
  employees: EmployeeRow[];
  /** Only an admin changes the catalog (RN-01); the database decides, this only hides buttons. */
  isAdmin: boolean;
};

type Editing = { mode: 'new' } | { mode: 'edit'; employee: EmployeeRow } | null;

/**
 * «Empleados» (spec 007, HU-02 to HU-04): the active employees, and apart the disabled ones with
 * their date (CA-12, CA-13). An admin sees their details and registers, corrects, disables (asking
 * first) and reactivates; an operator sees only the names (CA-16).
 */
const EmployeesScreen = ({ employees, isAdmin }: EmployeesScreenProps) => {
  const t = useTranslations('employees');
  const router = useRouter();
  const disabledId = useId();
  const [editing, setEditing] = useState<Editing>(null);
  const [disabling, setDisabling] = useState<EmployeeRow | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = employees.filter((employee) => employee.disabled_at === null);
  const disabled = employees.filter((employee) => employee.disabled_at !== null);

  const toggle = (employee: EmployeeRow, disable: boolean) =>
    startTransition(async () => {
      const result = await callAction(() =>
        setEmployeeDisabled({ id: employee.id, disabled: disable })
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
        onEdit: (employee: EmployeeRow) => {
          setEditing({ mode: 'edit', employee });
        },
        onDisable: (employee: EmployeeRow) => {
          setDisabling(employee);
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
            startContent={<UserPlus aria-hidden className="size-4" />}
            onPress={() => {
              setEditing({ mode: 'new' });
            }}
          >
            {t('new')}
          </Button>
        )}
      </div>

      <EmployeesTable
        employees={active}
        showDetails={isAdmin}
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
              <EmployeesTable
                employees={disabled}
                showDetails
                variant="disabled"
                label={t('table.disabledLabel')}
                isBusy={isPending}
                onReactivate={(employee) => {
                  toggle(employee, false);
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
                <EmployeeForm
                  employee={editing?.mode === 'edit' ? editing.employee : undefined}
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
        title={t('confirmDisable.title', { name: disabling?.full_name ?? '' })}
        description={t('confirmDisable.description')}
        confirmLabel={t('confirmDisable.confirm')}
        isPending={isPending}
        onCancel={() => setDisabling(null)}
        onConfirm={() => disabling && toggle(disabling, true)}
      />
    </section>
  );
};

export default EmployeesScreen;
