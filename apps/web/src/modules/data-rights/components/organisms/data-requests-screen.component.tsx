import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { ChevronRight } from 'lucide-react';

import type { DataRequestSummary } from '@web/modules/data-rights/types/data-rights.types';

type DataRequestsScreenProps = { requests: DataRequestSummary[] };

const LIST =
  'flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small';
const EMPTY =
  'rounded-medium border border-dashed border-default-300 p-4 text-center text-sm text-default-500';

/**
 * «Solicitudes de datos» (spec 017, CA-09): the pending ones first, the one due first on top, each
 * with its customer, kind, channel, dates and the business days left; the overdue ones marked. The
 * closed ones apart, newest first.
 */
const DataRequestsScreen = ({ requests }: DataRequestsScreenProps) => {
  const t = useTranslations('dataRights');
  const format = useFormatter();
  const day = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium' });
  const pending = requests
    .filter((request) => request.status === 'received')
    .sort((a, b) => a.due_on.localeCompare(b.due_on));
  const closed = requests
    .filter((request) => request.status !== 'received')
    .sort((a, b) => (b.resolved_at ?? '').localeCompare(a.resolved_at ?? ''));

  const row = (request: DataRequestSummary) => (
    <li key={request.id}>
      <Link
        href={`/admin/data-requests/${request.id}`}
        className="flex items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium">
            {t(`kinds.${request.kind}`)} · {request.customer_name}
          </span>
          <span className="text-xs text-default-500">
            {t(`channels.${request.channel}`)} ·{' '}
            {t('admin.receivedOn', { date: day(request.received_at) })}
          </span>
          {request.status === 'received' ? (
            <span className="text-xs text-default-500">
              {t('admin.dueOn', { date: day(`${request.due_on}T12:00:00Z`) })}
            </span>
          ) : (
            <span className="text-xs text-default-500">{t(`statuses.${request.status}`)}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {request.status === 'received' &&
            (request.overdue ? (
              <span className="rounded-full bg-danger-600 px-2 py-0.5 text-xs font-medium text-white dark:bg-danger-300">
                {t('admin.overdue')}
              </span>
            ) : (
              <span className="text-xs text-default-600">
                {t('admin.daysLeft', { days: request.business_days_left ?? 0 })}
              </span>
            ))}
          <ChevronRight aria-hidden className="size-4 text-default-400" />
        </span>
      </Link>
    </li>
  );

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <p className="text-default-500">{t('admin.description')}</p>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">{t('admin.pendingTitle')}</h2>
        {pending.length === 0 ? (
          <p className={EMPTY}>{t('admin.noPending')}</p>
        ) : (
          <ul aria-label={t('admin.pendingLabel')} className={LIST}>
            {pending.map(row)}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">{t('admin.closedTitle')}</h2>
        {closed.length === 0 ? (
          <p className={EMPTY}>{t('admin.noClosed')}</p>
        ) : (
          <ul aria-label={t('admin.closedLabel')} className={LIST}>
            {closed.map(row)}
          </ul>
        )}
      </div>
    </section>
  );
};

export default DataRequestsScreen;
