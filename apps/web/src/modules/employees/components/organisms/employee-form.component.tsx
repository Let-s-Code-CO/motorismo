'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { Alert, Button, Input, Select, SelectItem } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { IdCard, Percent, Phone, User } from 'lucide-react';

import { formatMobile } from '@web/modules/core/utils/phone.utils';
import { saveEmployee } from '@web/modules/employees/actions/employees.actions';
import type { EmployeeRow } from '@web/modules/employees/api/employees.server';
import { DOCUMENT_TYPES } from '@web/modules/employees/constants/employees.constants';
import {
  type EmployeeInput,
  type EmployeeValues,
  employeeSchema,
} from '@web/modules/employees/schemas/employee.schema';
import type { EmployeesErrorKey } from '@web/modules/employees/utils/employees-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type EmployeeFormProps = {
  /** The employee to correct; without it the form registers a new one. */
  employee?: EmployeeRow;
  onSaved: () => void;
  onCancel: () => void;
};

/**
 * An admin registers or corrects an employee (spec 007, HU-02): full name, document, optional
 * phone and commission (CA-07, CA-10). Every problem shows next to its field (CA-08); a document
 * already taken is refused, suggesting to reactivate a disabled employee (CA-09). A new employee
 * starts with a cédula (CC), the usual document.
 */
const EmployeeForm = ({ employee, onSaved, onCancel }: EmployeeFormProps) => {
  const t = useTranslations('employees');
  const [serverError, setServerError] = useState<EmployeesErrorKey>();
  // The document type list is drawn inside the form, so the modal does not hide it from screen
  // readers (CLAUDE.md: drop-downs in a modal).
  const [popoverRoot, setPopoverRoot] = useState<HTMLDivElement | null>(null);
  const details = employee?.details;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeInput, unknown, EmployeeValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      full_name: employee?.full_name ?? '',
      document_type: details?.document_type ?? 'cc',
      document_number: details?.document_number ?? '',
      phone: details?.phone ? formatMobile(details.phone) : '',
      commission_pct: details ? String(details.commission_pct) : '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() => saveEmployee({ id: employee?.id ?? null, ...values }));
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) onSaved();
    else setServerError(result.error);
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);
  const field = {
    variant: 'bordered',
    labelPlacement: 'outside',
    validationBehavior: 'aria',
  } as const;
  const icon = 'size-4 shrink-0 text-default-400';

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-5">
      <div ref={setPopoverRoot} />
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}
      <Input
        {...register('full_name')}
        {...field}
        label={t('form.fullName')}
        placeholder={t('form.fullNamePlaceholder')}
        startContent={<User aria-hidden className={icon} />}
        isInvalid={!!errors.full_name}
        errorMessage={fieldError(errors.full_name?.message)}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Controller
          control={control}
          name="document_type"
          render={({ field: { value, onChange, onBlur } }) => (
            <Select
              {...field}
              label={t('form.documentType')}
              selectedKeys={value ? [value] : []}
              onSelectionChange={(keys) => {
                const [key] = Array.from(keys);
                if (key) onChange(key);
              }}
              onClose={onBlur}
              popoverProps={{ portalContainer: popoverRoot ?? undefined, containerPadding: 0 }}
              isInvalid={!!errors.document_type}
              errorMessage={fieldError(errors.document_type?.message)}
            >
              {DOCUMENT_TYPES.map((type) => (
                <SelectItem key={type}>{t(`documentTypes.${type}`)}</SelectItem>
              ))}
            </Select>
          )}
        />
        <Input
          {...register('document_number')}
          {...field}
          label={t('form.documentNumber')}
          placeholder={t('form.documentNumberPlaceholder')}
          startContent={<IdCard aria-hidden className={icon} />}
          isInvalid={!!errors.document_number}
          errorMessage={fieldError(errors.document_number?.message)}
        />
        <Input
          {...register('phone')}
          {...field}
          type="tel"
          inputMode="tel"
          label={t('form.phone')}
          placeholder={t('form.phonePlaceholder')}
          startContent={<Phone aria-hidden className={icon} />}
          isInvalid={!!errors.phone}
          errorMessage={fieldError(errors.phone?.message)}
        />
        <Input
          {...register('commission_pct')}
          {...field}
          inputMode="numeric"
          label={t('form.commission')}
          placeholder={t('form.commissionPlaceholder')}
          description={t('form.commissionHint')}
          endContent={<Percent aria-hidden className={icon} />}
          isInvalid={!!errors.commission_pct}
          errorMessage={fieldError(errors.commission_pct?.message)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="light" onPress={onCancel}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
          {employee ? t('form.submitEdit') : t('form.submitNew')}
        </Button>
      </div>
    </form>
  );
};

export default EmployeeForm;
