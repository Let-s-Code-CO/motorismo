'use client';

import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { useQuery } from '@tanstack/react-query';

import { Alert, Button, Input, Textarea } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import { formatAmount, formatPesos } from '@web/modules/core/utils/money.utils';
import { singleOption } from '@web/modules/core/utils/selection.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import { linesFromReservation } from '@web/modules/reservations/utils/reservation-lines.utils';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import { saveWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import OrderEstimate from '@web/modules/work-orders/components/molecules/order-estimate.component';
import OrderLine from '@web/modules/work-orders/components/molecules/order-line.component';
import OrderSummary from '@web/modules/work-orders/components/molecules/order-summary.component';
import {
  activeEmployeesQueryOptions,
  activeServicesQueryOptions,
} from '@web/modules/work-orders/queries/work-orders.queries';
import {
  type LineInput,
  type WorkOrderInput,
  type WorkOrderValues,
  workOrderSchema,
} from '@web/modules/work-orders/schemas/work-order.schema';
import type {
  EmployeeOption,
  PickerCustomer,
  ServiceOption,
  WorkOrderDetail,
} from '@web/modules/work-orders/types/work-orders.types';
import { referencePrice, typedPesos } from '@web/modules/work-orders/utils/line-price.utils';
import { orderTotals } from '@web/modules/work-orders/utils/order-totals.utils';
import type { WorkOrdersErrorKey } from '@web/modules/work-orders/utils/work-orders-errors.utils';

type OrderEditorProps = {
  customer: Pick<PickerCustomer, 'id' | 'full_name'>;
  vehicle: { id: string; vehicle_type: VehicleType };
  /** The open order being edited (CA-08); without it a new order is opened (CA-07). */
  order?: WorkOrderDetail;
  /**
   * When the order was started: the ready time counts from it (CA-34). Absent for a new order or one
   * still in the queue, which show only their duration (RN-12).
   */
  startedAt?: Date;
  onSaved: (orderId: string) => void;
  onCancel?: () => void;
  /**
   * Correcting a closed order (CA-22): the checked values go on to the payments and the reason
   * instead of being saved here.
   */
  onCorrect?: (values: WorkOrderValues) => void;
  /**
   * The reservation the customer arrived with (spec 012, CA-12, CA-13): a new order starts with its
   * services as the catalog has them now (RN-07); saving turns it into this order.
   */
  reservation?: Pick<ReservationSummary, 'id' | 'service_ids' | 'services' | 'slot_start'>;
};

const asText = (value: number | null | undefined) => (value == null ? '' : formatAmount(value));

const linesOf = (order?: WorkOrderDetail): LineInput[] =>
  (order?.lines ?? []).map((line) => ({
    id: line.id,
    service_id: line.service_id,
    name: line.name,
    price: asText(line.price),
    estimated_minutes: line.estimated_minutes == null ? '' : String(line.estimated_minutes),
    employees: line.employees.map(({ employee_id, share_pct }) => ({
      employee_id,
      share_pct: String(share_pct),
    })),
  }));

/**
 * The services of an order, who does them and what it adds up to (spec 008, HU-01). Services are
 * added with one tap — only those with a price for the vehicle type (CA-03) — or as «Otro» (CA-05);
 * the totals are always in sight (CA-04, CA-25). With only one active employee, each new line
 * already has them (RN-10).
 */
const OrderEditor = ({
  customer,
  vehicle,
  order,
  startedAt,
  onSaved,
  onCancel,
  onCorrect,
  reservation,
}: OrderEditorProps) => {
  const t = useTranslations('orders');
  const clock = useClock();
  const [skipped, setSkipped] = useState<string[]>([]);
  const reservationApplied = useRef(false);
  const [serverError, setServerError] = useState<WorkOrdersErrorKey>();
  const services = useQuery(activeServicesQueryOptions());
  const employees = useQuery(activeEmployeesQueryOptions());

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkOrderInput, unknown, WorkOrderValues>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: {
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      lines: linesOf(order),
      discount: order?.summary.discount ? asText(order.summary.discount) : '',
      notes: order?.summary.notes ?? '',
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: 'lines' }) ?? [];
  const discount = useWatch({ control, name: 'discount' });
  const totals = orderTotals(
    lines.map((line) => ({ price: typedPesos(line?.price) })),
    typedPesos(discount)
  );

  // The ready time counts from the start (CA-34); not started yet, only the duration (RN-12).
  const start =
    startedAt ?? (order?.summary.started_at ? new Date(order.summary.started_at) : null);
  const estimateLines = lines.map((line) => ({
    name: line?.service_id ? (line.name ?? '') : line?.name?.trim() || t('editor.other'),
    estimated_minutes: /^\d+$/.test(String(line?.estimated_minutes ?? '').trim())
      ? Number(String(line?.estimated_minutes).trim())
      : null,
  }));

  const offered = (services.data ?? []).filter(
    (service) => referencePrice(service, vehicle.vehicle_type) !== null
  );
  const active = employees.data ?? [];
  const defaultEmployees = () => {
    const only = singleOption(active);
    return only ? [{ employee_id: only.id, share_pct: '100' }] : [];
  };

  const addService = (service: ServiceOption) =>
    append({
      id: null,
      service_id: service.id,
      name: service.name,
      price: asText(referencePrice(service, vehicle.vehicle_type)),
      estimated_minutes: service.estimated_minutes == null ? '' : String(service.estimated_minutes),
      employees: defaultEmployees(),
    });
  // Spec 012, CA-12: a new order from a reservation starts with its services, once, as soon as the
  // catalog and the employees are known (RN-10: the only employee is already on each line).
  useEffect(() => {
    if (!reservation || order || reservationApplied.current || !services.data || !employees.data)
      return;
    reservationApplied.current = true;
    const fromReservation = linesFromReservation(reservation, services.data, vehicle.vehicle_type);
    fromReservation.services.forEach(addService);
    setSkipped(fromReservation.skipped);
    // addService only reads the vehicle and the employees, both known here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation, order, services.data, employees.data]);

  const addOther = () =>
    append({
      id: null,
      service_id: null,
      name: '',
      price: '',
      estimated_minutes: '',
      employees: defaultEmployees(),
    });

  // Employees already on a line stay listed even if they were disabled later (RN-04).
  const employeesFor = (index: number): EmployeeOption[] => {
    const onLine = (order?.lines.find((line) => line.id === fields[index]?.id)?.employees ?? [])
      .filter(({ employee_id }) => !active.some(({ id }) => id === employee_id))
      .map(({ employee_id, full_name }) => ({ id: employee_id, full_name }));
    return [...active, ...onLine];
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    if (onCorrect) {
      onCorrect(values);
      return;
    }
    const result = await callAction(() =>
      saveWorkOrder({
        id: order?.summary.id ?? null,
        reservation_id: reservation?.id ?? null,
        ...values,
      })
    );
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) onSaved(result.id);
    else setServerError(result.error);
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);
  const linesError =
    (errors.lines as { root?: { message?: string }; message?: string } | undefined)?.root
      ?.message ?? (errors.lines as { message?: string } | undefined)?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}
      {reservation?.slot_start && (
        <Alert
          color="primary"
          variant="faded"
          title={t(order ? 'editor.linkReservation' : 'editor.fromReservation', {
            time: clock(new Date(reservation.slot_start)),
          })}
          description={
            skipped.length ? t('editor.skipped', { names: skipped.join(', ') }) : undefined
          }
        />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">{t('editor.services')}</h2>
        <div className="flex flex-wrap gap-2">
          {offered.map((service) => (
            <Button
              key={service.id}
              size="sm"
              variant="bordered"
              startContent={<Plus aria-hidden className="size-3.5" />}
              onPress={() => addService(service)}
            >
              {/* The name read aloud contains the visible text (WCAG 2.5.3): «Añadir Micropulido $ …». */}
              <span className="sr-only">{t('editor.add')} </span>
              {service.name}
              <span className="text-default-500 tabular-nums">
                {formatPesos(referencePrice(service, vehicle.vehicle_type) ?? 0)}
              </span>
            </Button>
          ))}
          <Button
            size="sm"
            variant="bordered"
            startContent={<Plus aria-hidden className="size-3.5" />}
            onPress={addOther}
          >
            <span className="sr-only">{t('editor.add')} </span>
            {t('editor.other')}
          </Button>
        </div>
        {linesError && (
          <p role="alert" className="text-sm text-danger">
            {fieldError(linesError)}
          </p>
        )}
        {fields.map((field, index) => (
          <OrderLine
            key={field.id}
            index={index}
            control={control}
            register={register}
            errors={errors}
            title={field.service_id ? field.name : lines[index]?.name?.trim() || t('editor.other')}
            isOther={!field.service_id}
            employees={employeesFor(index)}
            onRemove={() => remove(index)}
          />
        ))}
      </section>

      <Textarea
        {...register('notes')}
        label={t('editor.notes')}
        placeholder={t('editor.notesPlaceholder')}
        variant="bordered"
        labelPlacement="outside"
        minRows={2}
        validationBehavior="aria"
        isInvalid={!!errors.notes}
        errorMessage={fieldError(errors.notes?.message)}
      />

      {/* CA-04: on phones the summary stays at the bottom while the lines scroll, opaque and above
          the fields' floating labels; from md it simply follows the lines (it would cover them). */}
      <div className="sticky bottom-0 z-30 -mx-1 border-t border-divider bg-background px-1 pt-2 pb-3 md:static md:border-0 md:p-0">
        <OrderSummary
          subtotal={totals.subtotal}
          total={totals.total}
          discount={
            <>
              <dt className="text-default-500">
                <label htmlFor="order-discount">{t('summary.discount')}</label>
              </dt>
              <dd className="w-32">
                <Input
                  {...register('discount')}
                  id="order-discount"
                  aria-label={t('summary.discount')}
                  size="sm"
                  inputMode="numeric"
                  variant="bordered"
                  startContent={<span className="text-sm text-default-400">$</span>}
                  validationBehavior="aria"
                  isInvalid={!!errors.discount}
                  errorMessage={fieldError(errors.discount?.message)}
                />
              </dd>
            </>
          }
          estimate={<OrderEstimate lines={estimateLines} startedAt={start} />}
        />
        <div className="mt-3 flex justify-end gap-2">
          {onCancel && (
            <Button variant="light" onPress={onCancel}>
              {t('editor.cancel')}
            </Button>
          )}
          <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
            {onCorrect ? t('correct.continue') : order ? t('editor.saveChanges') : t('editor.save')}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default OrderEditor;
