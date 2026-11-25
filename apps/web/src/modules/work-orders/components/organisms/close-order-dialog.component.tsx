'use client';

import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';

import { formatAmount, formatPesos } from '@web/modules/core/utils/money.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import {
  closeWorkOrder,
  correctWorkOrder,
} from '@web/modules/work-orders/actions/work-orders.actions';
import { PAYMENT_METHODS } from '@web/modules/work-orders/constants/work-orders.constants';
import {
  type PaymentsInput,
  type PaymentsValues,
  paymentsSchema,
} from '@web/modules/work-orders/schemas/payments.schema';
import type { WorkOrderValues } from '@web/modules/work-orders/schemas/work-order.schema';
import type { PaymentMethod } from '@web/modules/work-orders/types/work-orders.types';
import { typedPesos } from '@web/modules/work-orders/utils/line-price.utils';
import type { WorkOrdersErrorKey } from '@web/modules/work-orders/utils/work-orders-errors.utils';

type CloseOrderDialogProps = {
  orderId: string;
  number: number;
  total: number;
  isOpen: boolean;
  onCancel: () => void;
  onClosed: () => void;
  /**
   * An admin correcting a closed order (CA-22): the corrected lines, the payments it had (kept when
   * they still add up) and a required reason; saving corrects instead of closing.
   */
  correction?: {
    values: WorkOrderValues;
    payments: { method: PaymentMethod; amount: number }[];
  };
};

/**
 * Closing an order when the vehicle is handed over (spec 008, HU-02): the payments, by method,
 * adding up to the total (CA-11). The first one comes for the whole total in cash, so the usual case
 * is one tap; each method added proposes what is missing with a method not used yet. An order of
 * $ 0 needs no payment (CA-13). The database checks it all again (CA-12). An admin correcting a
 * closed order confirms its payments and a reason here too (CA-22).
 */
const CloseOrderDialog = ({
  orderId,
  number,
  total,
  isOpen,
  onCancel,
  onClosed,
  correction,
}: CloseOrderDialogProps) => {
  const t = useTranslations('orders');
  const [serverError, setServerError] = useState<WorkOrdersErrorKey>();
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const previous = correction?.payments ?? [];
  const keepPrevious =
    previous.length > 0 && previous.reduce((sum, { amount }) => sum + amount, 0) === total;
  const [popoverRoot, setPopoverRoot] = useState<HTMLDivElement | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentsInput, unknown, PaymentsValues>({
    resolver: zodResolver(paymentsSchema(total)),
    defaultValues: {
      payments: keepPrevious
        ? previous.map(({ method, amount }) => ({ method, amount: formatAmount(amount) }))
        : total > 0
          ? [{ method: 'cash', amount: formatAmount(total) }]
          : [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'payments' });
  const payments = useWatch({ control, name: 'payments' }) ?? [];
  const paid = payments.reduce((sum, payment) => sum + (typedPesos(payment?.amount) ?? 0), 0);
  const remaining = total - paid;

  const addPayment = () => {
    const used = new Set(payments.map((payment) => payment?.method));
    append({
      method: PAYMENT_METHODS.find((method) => !used.has(method)) ?? 'other',
      amount: remaining > 0 ? formatAmount(remaining) : '',
    });
  };

  const onSubmit = handleSubmit(async ({ payments: values }) => {
    setServerError(undefined);
    if (correction && !reason.trim()) {
      setReasonMissing(true);
      return;
    }
    const result = await callAction(() =>
      correction
        ? correctWorkOrder({ id: orderId, ...correction.values, payments: values, reason })
        : closeWorkOrder({ id: orderId, payments: values })
    );
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) onClosed();
    else setServerError(result.error);
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);
  const mismatch =
    (errors.payments as { root?: { message?: string }; message?: string } | undefined)?.root
      ?.message ?? (errors.payments as { message?: string } | undefined)?.message;

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onCancel()} scrollBehavior="outside">
      <ModalContent>
        <form onSubmit={onSubmit} noValidate className="relative">
          <div ref={setPopoverRoot} />
          <ModalHeader>
            {correction ? t('correct.title', { number }) : t('close.title', { number })}
          </ModalHeader>
          <ModalBody className="gap-4">
            {serverError && (
              <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />
            )}
            <div className="flex items-center justify-between text-base font-semibold">
              <span>{t('close.total')}</span>
              <span className="tabular-nums">{formatPesos(total)}</span>
            </div>
            {total === 0 ? (
              <p className="text-sm text-default-500">{t('close.courtesy')}</p>
            ) : (
              <>
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <Controller
                      control={control}
                      name={`payments.${index}.method`}
                      render={({ field: { value, onChange } }) => (
                        <Select
                          label={t('close.method')}
                          labelPlacement="outside"
                          variant="bordered"
                          className="flex-1"
                          selectedKeys={value ? [value] : []}
                          onSelectionChange={(keys) => {
                            const [key] = Array.from(keys);
                            if (key) onChange(key);
                          }}
                          popoverProps={{
                            portalContainer: popoverRoot ?? undefined,
                            containerPadding: 0,
                          }}
                        >
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method}>{t(`methods.${method}`)}</SelectItem>
                          ))}
                        </Select>
                      )}
                    />
                    <Input
                      {...register(`payments.${index}.amount`)}
                      label={t('close.amount')}
                      labelPlacement="outside"
                      variant="bordered"
                      inputMode="numeric"
                      className="flex-1"
                      startContent={<span className="text-sm text-default-400">$</span>}
                      validationBehavior="aria"
                      isInvalid={!!errors.payments?.[index]?.amount}
                      errorMessage={fieldError(errors.payments?.[index]?.amount?.message)}
                    />
                    {fields.length > 1 && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="mt-7 text-danger-600"
                        aria-label={t('close.removePayment')}
                        onPress={() => remove(index)}
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="light"
                  className="w-max"
                  startContent={<Plus aria-hidden className="size-4" />}
                  onPress={addPayment}
                >
                  {t('close.addPayment')}
                </Button>
                <p aria-live="polite" className="text-sm text-default-600 tabular-figures">
                  {remaining > 0
                    ? t('close.remaining', { amount: formatPesos(remaining) })
                    : remaining < 0
                      ? t('close.excess', { amount: formatPesos(-remaining) })
                      : t('close.balanced')}
                </p>
                {mismatch && (
                  <p role="alert" className="text-sm text-danger">
                    {fieldError(mismatch)}
                  </p>
                )}
              </>
            )}
            {correction && (
              <Textarea
                label={t('correct.reason')}
                placeholder={t('correct.reasonPlaceholder')}
                labelPlacement="outside"
                variant="bordered"
                minRows={2}
                value={reason}
                onValueChange={(value) => {
                  setReason(value);
                  setReasonMissing(false);
                }}
                validationBehavior="aria"
                isInvalid={reasonMissing}
                errorMessage={reasonMissing ? t('validation.reasonRequired') : undefined}
              />
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onCancel}>
              {t('close.cancel')}
            </Button>
            <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
              {correction ? t('correct.confirm') : t('close.confirm')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default CloseOrderDialog;
