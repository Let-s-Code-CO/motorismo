'use client';

import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  useController,
} from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { Button, Input } from '@heroui/react';
import { Trash2 } from 'lucide-react';

import type {
  WorkOrderInput,
  WorkOrderValues,
} from '@web/modules/work-orders/schemas/work-order.schema';
import type { EmployeeOption } from '@web/modules/work-orders/types/work-orders.types';
import { splitShares } from '@web/modules/work-orders/utils/shares.utils';

type OrderLineProps = {
  index: number;
  control: Control<WorkOrderInput, unknown, WorkOrderValues>;
  register: UseFormRegister<WorkOrderInput>;
  errors: FieldErrors<WorkOrderInput>;
  /** The line's title: the service name, or «Otro». */
  title: string;
  isOther: boolean;
  /** What its service includes, by name (spec 024, CA-27). */
  includes?: string[];
  /** Who can be assigned: the active employees, plus anyone already on the line. */
  employees: EmployeeOption[];
  onRemove: () => void;
};

/**
 * One service of the order (spec 008): its price, editable (CA-03); a description for «Otro»
 * (CA-05); and the employees who do it, sharing it in equal parts that can be changed (CA-06).
 */
const OrderLine = ({
  index,
  control,
  register,
  errors,
  title,
  isOther,
  includes = [],
  employees,
  onRemove,
}: OrderLineProps) => {
  const t = useTranslations('orders');
  const lineErrors = errors.lines?.[index];
  const fieldError = (message?: string) => message && t(`validation.${message}`);
  const { field: assigned } = useController({ control, name: `lines.${index}.employees` });
  const chosen = assigned.value ?? [];

  const toggle = (employeeId: string) => {
    const ids = chosen.some((e) => e.employee_id === employeeId)
      ? chosen.filter((e) => e.employee_id !== employeeId).map((e) => e.employee_id)
      : [...chosen.map((e) => e.employee_id), employeeId];
    const shares = splitShares(ids.length);
    assigned.onChange(ids.map((id, i) => ({ employee_id: id, share_pct: String(shares[i]) })));
  };

  const setShare = (employeeId: string, value: string) =>
    assigned.onChange(
      chosen.map((e) => (e.employee_id === employeeId ? { ...e, share_pct: value } : e))
    );

  const nameOf = (id: string) => employees.find((e) => e.id === id)?.full_name ?? '';
  const sharesError = (lineErrors?.employees as { message?: string } | undefined)?.message;

  return (
    <fieldset
      aria-label={title}
      className="flex flex-col gap-3 rounded-large border border-divider bg-content1 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-0.5 pt-1">
          <span className="font-medium">{title}</span>
          {includes.length > 0 && (
            <span className="text-xs text-default-500">
              {t('editor.includes', { names: includes.join(', ') })}
            </span>
          )}
        </span>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label={t('editor.removeLine', { name: title })}
          className="text-danger-600"
          onPress={onRemove}
        >
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isOther && (
          <Input
            {...register(`lines.${index}.name`)}
            label={t('editor.otherName')}
            placeholder={t('editor.otherNamePlaceholder')}
            variant="bordered"
            labelPlacement="outside"
            validationBehavior="aria"
            className="sm:col-span-2"
            isInvalid={!!lineErrors?.name}
            errorMessage={fieldError(lineErrors?.name?.message)}
          />
        )}
        <Input
          {...register(`lines.${index}.price`)}
          label={t('editor.price')}
          inputMode="numeric"
          variant="bordered"
          labelPlacement="outside"
          validationBehavior="aria"
          startContent={<span className="text-sm text-default-400">$</span>}
          isInvalid={!!lineErrors?.price}
          errorMessage={fieldError(lineErrors?.price?.message)}
        />
        {/* CA-27, CA-28: the service's time, editable for this order only; blank is «Sin estimar». */}
        <Input
          {...register(`lines.${index}.estimated_minutes`)}
          label={t('editor.minutes')}
          placeholder={t('editor.notEstimated')}
          inputMode="numeric"
          variant="bordered"
          labelPlacement="outside"
          validationBehavior="aria"
          isInvalid={!!lineErrors?.estimated_minutes}
          errorMessage={fieldError(lineErrors?.estimated_minutes?.message)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-default-600">{t('editor.employees')}</span>
        <div className="flex flex-wrap gap-2">
          {employees.map((employee) => {
            const pressed = chosen.some((e) => e.employee_id === employee.id);
            return (
              <Button
                key={employee.id}
                size="sm"
                variant={pressed ? 'solid' : 'bordered'}
                color={pressed ? 'primary' : 'default'}
                aria-pressed={pressed}
                onPress={() => toggle(employee.id)}
              >
                {employee.full_name}
              </Button>
            );
          })}
        </div>
        {chosen.length > 1 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {chosen.map(({ employee_id, share_pct }) => (
              <div key={employee_id} className="flex flex-col gap-1">
                {/* Visible name only; the field is announced as «Participación de …». */}
                <span aria-hidden className="truncate text-xs text-default-600">
                  {nameOf(employee_id)}
                </span>
                <Input
                  aria-label={t('editor.share', { name: nameOf(employee_id) })}
                  value={String(share_pct ?? '')}
                  onValueChange={(value) => setShare(employee_id, value)}
                  inputMode="numeric"
                  size="sm"
                  variant="bordered"
                  endContent={<span className="text-sm text-default-400">%</span>}
                />
              </div>
            ))}
          </div>
        )}
        {sharesError && (
          <p role="alert" className="text-xs text-danger">
            {fieldError(sharesError)}
          </p>
        )}
      </div>
    </fieldset>
  );
};

export default OrderLine;
