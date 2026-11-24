'use client';

import { useState, useTransition } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Input, Textarea } from '@heroui/react';
import { button } from '@heroui/theme';
import { ArrowLeft, Download } from 'lucide-react';

import ConfirmDialog from '@web/modules/core/components/confirm-dialog.component';
import useClock from '@web/modules/core/hooks/clock.hook';
import { notify } from '@web/modules/core/lib/toast.lib';
import {
  correctCustomerEmail,
  eraseCustomerData,
  rejectDataRequest,
  resolveDataRequest,
} from '@web/modules/data-rights/actions/data-rights.actions';
import { answerSchema, emailSchema } from '@web/modules/data-rights/schemas/data-rights.schema';
import type { DataRequestSummary } from '@web/modules/data-rights/types/data-rights.types';
import type { DataRightsErrorKey } from '@web/modules/data-rights/utils/data-rights-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type DataRequestDetailProps = {
  request: DataRequestSummary;
  /** The open order that stops an erasure, if any (CA-13). */
  openOrder: number | null;
};

const CARD = 'flex flex-col gap-3 rounded-large border border-divider bg-content1 p-5 shadow-small';

/**
 * A data request for the admin (spec 017, HU-03): what was asked, by whom and by when (CA-09); its
 * customer's record to correct name and phone, and here the email of an account with a password
 * (CA-11, RN-08); «Marcar atendida» or «Rechazar» with an answer (CA-11, CA-14); for an erasure,
 * «Suprimir datos», asked first, or the open order that stops it (CA-12, CA-13). A closed one is
 * only read (CA-19).
 */
const DataRequestDetail = ({ request, openOrder }: DataRequestDetailProps) => {
  const t = useTranslations('dataRights');
  const format = useFormatter();
  const clock = useClock();
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [answerError, setAnswerError] = useState<string>();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [serverError, setServerError] = useState<DataRightsErrorKey>();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const day = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'long' });
  const isOpen = request.status === 'received';
  const canChangeEmail =
    request.kind === 'correction' &&
    !request.customer_erased &&
    request.customer_origin !== 'google';

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: DataRightsErrorKey } | null>,
    done: string
  ) =>
    startTransition(async () => {
      setServerError(undefined);
      const result = await action();
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (!result.ok) {
        setServerError(result.error);
        return;
      }
      notify({ tone: 'success', text: done });
      router.refresh();
    });

  const withAnswer = (kind: 'attend' | 'reject') => {
    const parsed = answerSchema.safeParse({ response: answer });
    if (!parsed.success) {
      setAnswerError(t(`validation.${parsed.error.issues[0]!.message}`));
      return;
    }
    run(
      () =>
        callAction(() =>
          kind === 'attend'
            ? resolveDataRequest({ id: request.id, response: answer })
            : rejectDataRequest({ id: request.id, response: answer })
        ),
      t(kind === 'attend' ? 'admin.attended' : 'admin.rejected')
    );
  };

  const changeEmail = () => {
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setEmailError(t(`validation.${parsed.error.issues[0]!.message}`));
      return;
    }
    run(
      () => callAction(() => correctCustomerEmail({ customerId: request.customer_id, email })),
      t('admin.emailChanged')
    );
  };

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/data-requests"
          className="inline-flex w-max items-center gap-1.5 text-sm font-medium text-default-600 hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('admin.back')}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t(`kinds.${request.kind}`)} · {request.customer_name}
        </h1>
      </div>

      <div className={CARD}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-default-500">{t('admin.customer')}</dt>
          <dd>
            {request.customer_erased ? (
              t('admin.erasedCustomer')
            ) : (
              <Link
                href={`/customers/${request.customer_id}`}
                className="underline underline-offset-4"
              >
                {t('admin.seeRecord', { name: request.customer_name })}
              </Link>
            )}
          </dd>
          <dt className="text-default-500">{t('admin.channel')}</dt>
          <dd>{t(`channels.${request.channel}`)}</dd>
          <dt className="text-default-500">{t('admin.received')}</dt>
          <dd>
            {day(request.received_at)} · {clock(new Date(request.received_at))}
          </dd>
          <dt className="text-default-500">{t('admin.due')}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {day(`${request.due_on}T12:00:00Z`)}
            {isOpen &&
              (request.overdue ? (
                <span className="rounded-full bg-danger-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-danger-300">
                  {t('admin.overdue')}
                </span>
              ) : (
                <span className="text-xs text-default-600">
                  {t('admin.daysLeft', { days: request.business_days_left ?? 0 })}
                </span>
              ))}
          </dd>
          <dt className="text-default-500">{t('admin.status')}</dt>
          <dd>{t(`statuses.${request.status}`)}</dd>
          <dt className="text-default-500">{t('admin.asked')}</dt>
          <dd className="break-words whitespace-pre-line">
            {request.description ?? t('admin.noDescription')}
          </dd>
          {request.response && (
            <>
              <dt className="text-default-500">{t('admin.response')}</dt>
              <dd className="break-words whitespace-pre-line">{request.response}</dd>
            </>
          )}
          {request.resolved_by_name && (
            <>
              <dt className="text-default-500">{t('admin.resolvedBy')}</dt>
              <dd>
                {request.resolved_by_name}
                {request.resolved_at && ` · ${day(request.resolved_at)}`}
              </dd>
            </>
          )}
        </dl>
      </div>

      {!isOpen ? (
        <p className="text-sm text-default-500">{t('admin.readOnly')}</p>
      ) : (
        <>
          {request.kind === 'inquiry' && (
            <a
              href={`/customers/${request.customer_id}/data/export`}
              download
              className={button({ variant: 'bordered', className: 'w-max font-medium' })}
            >
              <Download aria-hidden className="size-4" />
              {t('admin.downloadData')}
            </a>
          )}

          {request.kind === 'correction' && (
            <div className={CARD}>
              <p className="text-sm text-default-600">{t('admin.correctionHelp')}</p>
              {canChangeEmail ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <Input
                    type="email"
                    label={t('admin.emailLabel')}
                    labelPlacement="outside"
                    placeholder=" "
                    variant="bordered"
                    value={email}
                    onValueChange={(value) => {
                      setEmail(value);
                      setEmailError(undefined);
                    }}
                    isInvalid={!!emailError}
                    errorMessage={emailError}
                  />
                  <Button
                    variant="bordered"
                    className="font-medium sm:mt-6"
                    isDisabled={isPending}
                    onPress={changeEmail}
                  >
                    {t('admin.changeEmail')}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-default-600">{t('admin.googleEmail')}</p>
              )}
            </div>
          )}

          {request.kind === 'erasure' &&
            (openOrder !== null ? (
              <p className="rounded-medium border border-warning-300 bg-warning-50 px-3 py-2 text-sm text-foreground dark:border-warning-200/40 dark:bg-warning-50/10">
                {t('admin.openOrder', { number: openOrder })}
              </p>
            ) : (
              <Button
                color="danger"
                className="w-max bg-danger-600 font-medium data-[hover=true]:bg-danger-700 dark:bg-danger-300 dark:data-[hover=true]:bg-danger-200"
                isDisabled={isPending}
                onPress={() => setConfirming(true)}
              >
                {t('admin.erase')}
              </Button>
            ))}

          <div className={CARD}>
            <Textarea
              label={t('admin.answerLabel')}
              labelPlacement="outside"
              variant="bordered"
              value={answer}
              onValueChange={(value) => {
                setAnswer(value);
                setAnswerError(undefined);
              }}
              isInvalid={!!answerError}
              errorMessage={answerError}
              maxLength={1000}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="bordered"
                isDisabled={isPending}
                onPress={() => withAnswer('reject')}
              >
                {t('admin.reject')}
              </Button>
              {request.kind !== 'erasure' && (
                <Button
                  color="primary"
                  className="font-medium"
                  isDisabled={isPending}
                  onPress={() => withAnswer('attend')}
                >
                  {t('admin.attend')}
                </Button>
              )}
            </div>
          </div>

          {serverError && (
            <p role="alert" className="text-sm text-danger">
              {t(`errors.${serverError}`)}
            </p>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirming}
        title={t('admin.eraseTitle', { name: request.customer_name })}
        description={t('admin.eraseText')}
        confirmLabel={t('admin.erase')}
        isPending={isPending}
        onConfirm={() => {
          setConfirming(false);
          run(() => callAction(() => eraseCustomerData({ id: request.id })), t('admin.erased'));
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};

export default DataRequestDetail;
