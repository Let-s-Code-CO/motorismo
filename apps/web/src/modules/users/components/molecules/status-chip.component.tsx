'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';

import type { UserStatus } from '@web/modules/auth/types/auth.types';

const COLOR = { invited: 'warning', active: 'success', disabled: 'default' } as const;

const StatusChip = ({ status }: { status: UserStatus }) => {
  const t = useTranslations('users.status');

  return (
    <Chip size="sm" variant="dot" color={COLOR[status]}>
      {t(status)}
    </Chip>
  );
};

export default StatusChip;
