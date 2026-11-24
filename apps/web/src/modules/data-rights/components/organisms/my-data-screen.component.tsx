'use client';

import { type ReactNode, useState, useTransition } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@heroui/react';
import { button } from '@heroui/theme';
import { ArrowLeft, Download } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import { notify } from '@web/modules/core/lib/toast.lib';
import { formatPesos } from '@web/modules/core/utils/money.utils';
import { formatMobile } from '@web/modules/core/utils/phone.utils';
import {
  requestCorrection,
  requestErasure,
  withdrawDataRequest,
} from '@web/modules/data-rights/actions/data-rights.actions';
import { correctionSchema } from '@web/modules/data-rights/schemas/data-rights.schema';
import type { CustomerData, MyDataRequest } from '@web/modules/data-rights/types/data-rights.types';
import type { DataRightsErrorKey } from '@web/modules/data-rights/utils/data-rights-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { formatPlate } from '@web/modules/vehicles/utils/plate.utils';

type MyDataScreenProps = {
  data: CustomerData;
  /** Their requests, with what they can withdraw (CA-07, CA-08). */
  requests: MyDataRequest[];
};

const CARD = 'flex flex-col gap-3 rounded-large border border-divider bg-content1 p-5 shadow-small';
const LIST = 'flex flex-col divide-y divide-divider text-sm';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className={CARD}>
    <h2 className="text-base font-semibold tracking-tight">{title}</h2>
    {children}
  </section>
);

/** A day as written in Colombia: «24 nov 2026». */
const useDay = () => {
  const format = useFormatter();
  return (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });
};

/**
 * «Mis datos» (spec 017, HU-01, HU-02): everything the business keeps of the customer (CA-01),
 * downloadable (CA-02); a correction or the erasure asked from here (CA-04, CA-05), one open per
 * kind (CA-06), and their requests with their state and answer, withdrawable while received
 * (CA-07, CA-08).
 */
const MyDataScreen = ({ data, requests }: MyDataScreenProps) => {
  const t = useTranslations('dataRights');
  const day = useDay();
  const clock = useClock();
  const router = useRouter();
  const format = useFormatter();
  const [dialog, setDialog] = useState<'correction' | 'erasure' | null>(null);
  const [text, setText] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [serverError, setServerError] = useState<DataRightsErrorKey>();
  const [isPending, startTransition] = useTransition();
  const { profile } = data;

  const isOpen = (kind: 'correction' | 'erasure') =>
    requests.some((request) => request.kind === kind && request.status === 'received');
  const vehicleOf = (vehicle: { brand: string; line: string | null; plate: string | null }) =>
    `${[vehicle.brand, vehicle.line].filter(Boolean).join(' ')} · ${
      vehicle.plate ? formatPlate(vehicle.plate) : t('my.noPlate')
    }`;

  const open = (kind: 'correction' | 'erasure') => {
    setText('');
    setFieldError(undefined);
    setServerError(undefined);
    setDialog(kind);
  };

  const send = () => {
    if (dialog === 'correction') {
      const parsed = correctionSchema.safeParse({ description: text });
      if (!parsed.success) {
        setFieldError(t(`validation.${parsed.error.issues[0]!.message}`));
        return;
      }
    }
    startTransition(async () => {
      const result = await callAction(() =>
        dialog === 'correction'
          ? requestCorrection({ description: text })
          : requestErasure({ reason: text })
      );
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      setDialog(null);
      notify({ tone: 'success', text: t('my.sentShort') });
      router.refresh();
    });
  };

  const withdraw = (request: MyDataRequest) =>
    startTransition(async () => {
      const result = await callAction(() => withdrawDataRequest({ id: request.id }));
      if (!result) return;
      notify(
        result.ok
          ? { tone: 'success', text: t('my.withdrawn') }
          : { tone: 'danger', text: t(`errors.${result.error}`) }
      );
      router.refresh();
    });

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/profile"
          className="inline-flex w-max items-center gap-1.5 text-sm font-medium text-default-600 hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('my.back')}
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('my.title')}</h1>
          <p className="text-default-500">{t('my.description')}</p>
        </div>
        {/* CA-02: a file, not a page: a real link that downloads it. */}
        <a
          href="/my/data/export"
          download
          className={button({ variant: 'bordered', className: 'w-max font-medium' })}
        >
          <Download aria-hidden className="size-4" />
          {t('my.download')}
        </a>
      </div>

      <Section title={t('my.profileTitle')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-default-500">{t('my.name')}</dt>
          <dd className="break-words">{profile.full_name}</dd>
          <dt className="text-default-500">{t('my.email')}</dt>
          <dd className="break-all">{profile.email ?? t('my.none')}</dd>
          <dt className="text-default-500">{t('my.phone')}</dt>
          <dd>{profile.phone ? formatMobile(profile.phone) : t('my.none')}</dd>
          <dt className="text-default-500">{t('my.account')}</dt>
          <dd>{t(`origins.${profile.origin}`)}</dd>
          <dt className="text-default-500">{t('my.registeredAt')}</dt>
          <dd>{day(profile.registered_at)}</dd>
        </dl>
        <p className="text-sm text-default-600">
          {t('my.consent', {
            date: format.dateTime(new Date(profile.consent_at), { dateStyle: 'long' }),
          })}{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            {t('my.policy')}
          </Link>
        </p>
      </Section>

      <Section title={t('my.vehiclesTitle')}>
        {data.vehicles.length === 0 ? (
          <p className="text-sm text-default-500">{t('my.noVehicles')}</p>
        ) : (
          <ul className={LIST}>
            {data.vehicles.map((vehicle, index) => (
              <li key={index} className="flex items-center justify-between gap-3 py-2">
                <span>{vehicleOf(vehicle)}</span>
                {vehicle.retired_at && (
                  <span className="rounded-full border border-default-300 px-2 py-0.5 text-xs">
                    {t('my.retired')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('my.ordersTitle')}>
        {data.orders.length === 0 ? (
          <p className="text-sm text-default-500">{t('my.noOrders')}</p>
        ) : (
          <ul className={LIST}>
            {data.orders.map((order) => (
              <li key={order.number} className="flex items-start justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">
                    {t('my.order', { number: order.number })} · {t(`orderStatuses.${order.status}`)}
                  </span>
                  <span className="text-xs text-default-500">
                    {day(order.opened_at)} · {vehicleOf(order.vehicle)}
                  </span>
                  <span className="text-xs text-default-500">
                    {order.services.map((service) => service.name).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatPesos(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('my.reservationsTitle')}>
        {data.reservations.length === 0 ? (
          <p className="text-sm text-default-500">{t('my.noReservations')}</p>
        ) : (
          <ul className={LIST}>
            {data.reservations.map((reservation) => (
              <li key={reservation.number} className="flex flex-col py-2">
                <span className="font-medium">
                  {day(reservation.slot_start)} · {clock(new Date(reservation.slot_start))} ·{' '}
                  {t(`reservationStatuses.${reservation.status}`)}
                </span>
                {reservation.services.length > 0 && (
                  <span className="text-xs text-default-500">
                    {reservation.services.join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t('my.requestsTitle')}>
        {requests.length === 0 ? (
          <p className="text-sm text-default-500">{t('my.noRequests')}</p>
        ) : (
          <ul className={LIST}>
            {requests.map((request) => {
              const label = t('my.requestLabel', {
                kind: t(`kinds.${request.kind}`),
                date: day(request.received_at),
              });
              return (
                <li key={request.id} className="flex flex-col gap-1 py-3">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    <span className="rounded-full border border-default-300 px-2 py-0.5 text-xs">
                      {t(`statuses.${request.status}`)}
                    </span>
                  </span>
                  {request.status === 'received' && (
                    <span className="text-xs text-default-500">
                      {t('my.dueOn', { date: day(`${request.due_on}T12:00:00Z`) })}
                    </span>
                  )}
                  {request.response && (
                    <span className="text-xs text-default-600">
                      {t('my.answer', { response: request.response })}
                    </span>
                  )}
                  {request.status === 'received' && (
                    <Button
                      size="sm"
                      variant="light"
                      className="w-max"
                      isDisabled={isPending}
                      onPress={() => withdraw(request)}
                    >
                      {/* WCAG 2.5.3: which request, before the visible text. */}
                      <span className="sr-only">
                        {t('my.withdrawLabel', {
                          kind: t(`kinds.${request.kind}`),
                          date: day(request.received_at),
                        })}{' '}
                      </span>
                      {t('my.withdraw')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={t('my.actionsTitle')}>
        <p className="text-sm text-default-600">{t('my.actionsText')}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="bordered"
            className="font-medium"
            isDisabled={isOpen('correction')}
            onPress={() => open('correction')}
          >
            {t('my.askCorrection')}
          </Button>
          <Button
            variant="bordered"
            className="font-medium"
            isDisabled={isOpen('erasure')}
            onPress={() => open('erasure')}
          >
            {t('my.askErasure')}
          </Button>
        </div>
        {isOpen('correction') && (
          <p className="text-xs text-default-500">{t('my.correctionOpen')}</p>
        )}
        {isOpen('erasure') && <p className="text-xs text-default-500">{t('my.erasureOpen')}</p>}
      </Section>

      <Modal
        isOpen={dialog !== null}
        onOpenChange={(isOpenNow) => !isOpenNow && setDialog(null)}
        placement="center"
        scrollBehavior="outside"
      >
        <ModalContent>
          <ModalHeader>
            {dialog === 'erasure' ? t('my.erasureTitle') : t('my.correctionTitle')}
          </ModalHeader>
          <ModalBody>
            {dialog === 'erasure' ? (
              <>
                <p className="text-sm text-default-600">{t('my.erasureText1')}</p>
                <p className="text-sm text-default-600">{t('my.erasureText2')}</p>
              </>
            ) : (
              <p className="text-sm text-default-600">{t('my.correctionHint')}</p>
            )}
            <Textarea
              label={dialog === 'erasure' ? t('my.erasureReason') : t('my.correctionLabel')}
              placeholder={dialog === 'erasure' ? undefined : t('my.correctionPlaceholder')}
              labelPlacement="outside"
              variant="bordered"
              value={text}
              onValueChange={(value) => {
                setText(value);
                setFieldError(undefined);
              }}
              isInvalid={!!fieldError}
              errorMessage={fieldError}
              maxLength={1000}
            />
          </ModalBody>
          <ModalFooter className="flex-col items-stretch gap-2">
            <div className="flex justify-end gap-2">
              <Button variant="light" onPress={() => setDialog(null)}>
                {t('my.cancel')}
              </Button>
              <Button
                color={dialog === 'erasure' ? 'danger' : 'primary'}
                className={
                  dialog === 'erasure'
                    ? 'bg-danger-600 font-medium data-[hover=true]:bg-danger-700 dark:bg-danger-300 dark:data-[hover=true]:bg-danger-200'
                    : 'font-medium'
                }
                isLoading={isPending}
                onPress={send}
              >
                {dialog === 'erasure' ? t('my.sendErasure') : t('my.send')}
              </Button>
            </div>
            {/* Spec 013: a dialog's error stays inside, under its button. */}
            {serverError && (
              <p role="alert" className="text-right text-sm text-danger">
                {t(`errors.${serverError}`)}
              </p>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
};

export default MyDataScreen;
