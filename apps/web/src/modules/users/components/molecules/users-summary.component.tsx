import { useTranslations } from 'next-intl';

import type { CurrentUser, UserStatus } from '@web/modules/auth/types/auth.types';

const STATUSES: { status: UserStatus; dot: string }[] = [
  { status: 'active', dot: 'bg-success' },
  { status: 'invited', dot: 'bg-warning' },
  { status: 'disabled', dot: 'bg-default-400' },
];

type UsersSummaryProps = {
  users: Pick<CurrentUser, 'status'>[];
  /** Status currently filtering the list, or null. */
  selected: UserStatus | null;
  /** Pressing a card filters by it; pressing the selected card again clears the filter. */
  onSelect: (status: UserStatus | null) => void;
};

/** How many users are in each status (spec 003, CA-07); each card is also a filter (CA-09). */
const UsersSummary = ({ users, selected, onSelect }: UsersSummaryProps) => {
  const t = useTranslations('users.summary');

  return (
    <div role="group" aria-label={t('filterLabel')} className="grid grid-cols-3 gap-3">
      {STATUSES.map(({ status, dot }) => {
        const count = users.filter((user) => user.status === status).length;
        const isSelected = selected === status;
        const isDimmed = selected !== null && !isSelected;

        return (
          <button
            key={status}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(isSelected ? null : status)}
            className={`min-w-0 rounded-large border bg-content1 p-3 text-left shadow-small transition-[transform,box-shadow,opacity,border-color] duration-200 outline-none hover:shadow-medium focus-visible:ring-2 focus-visible:ring-focus motion-safe:hover:-translate-y-0.5 sm:p-4 ${
              isSelected ? 'border-foreground ring-1 ring-foreground' : 'border-divider'
            } ${isDimmed ? 'opacity-55 hover:opacity-100' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-default-500 sm:gap-2 sm:text-xs">
              <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${dot}`} />
              <span className="truncate">{t(status)}</span>
            </span>
            {/* The accessible name comes from the visible text ("Activos 3", WCAG 2.5.3). */}{' '}
            <span className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default UsersSummary;
