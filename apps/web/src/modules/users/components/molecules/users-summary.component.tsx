import { useTranslations } from 'next-intl';

import type { CurrentUser, UserStatus } from '@web/modules/auth/types/auth.types';

const STATUSES: { status: UserStatus; key: 'active' | 'invited' | 'disabled'; dot: string }[] = [
  { status: 'active', key: 'active', dot: 'bg-success' },
  { status: 'invited', key: 'invited', dot: 'bg-warning' },
  { status: 'disabled', key: 'disabled', dot: 'bg-default-400' },
];

/** How many users are active, invited and disabled (spec 003, CA-07). */
const UsersSummary = ({ users }: { users: Pick<CurrentUser, 'status'>[] }) => {
  const t = useTranslations('users.summary');

  return (
    <dl aria-label={t('label')} className="grid grid-cols-3 gap-3">
      {STATUSES.map(({ status, key, dot }) => (
        <div
          key={status}
          className="min-w-0 rounded-large border border-divider bg-content1 p-3 shadow-small sm:p-4"
        >
          <dt className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-default-500 sm:gap-2 sm:text-xs">
            <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="truncate">{t(key)}</span>
          </dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {users.filter((user) => user.status === status).length}
          </dd>
        </div>
      ))}
    </dl>
  );
};

export default UsersSummary;
