'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@heroui/react';
import { X } from 'lucide-react';

import type { UserStatus } from '@web/modules/auth/types/auth.types';

type UsersFilterBarProps = {
  total: number;
  shown: number;
  status: UserStatus | null;
  onReset: () => void;
};

/** What the list shows and, while filtering, a quiet way back to everyone (spec 003, CA-09). */
const UsersFilterBar = ({ total, shown, status, onReset }: UsersFilterBarProps) => {
  const t = useTranslations('users');

  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <p aria-live="polite" className="text-sm text-default-500">
        {status
          ? t('filter.shown', { shown, total, status: t(`summary.${status}`) })
          : t('filter.total', { count: total })}
      </p>
      {status && (
        <Button
          size="sm"
          variant="light"
          radius="full"
          className="font-medium text-default-600 motion-safe:animate-fade-in"
          startContent={<X aria-hidden className="size-3.5" />}
          onPress={onReset}
        >
          {t('filter.reset')}
        </Button>
      )}
    </div>
  );
};

export default UsersFilterBar;
