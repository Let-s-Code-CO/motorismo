'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';

import type { UserRole } from '@web/modules/auth/types/auth.types';

const RoleChip = ({ role }: { role: UserRole }) => {
  const t = useTranslations('auth.roles');

  return (
    <Chip
      size="sm"
      radius="sm"
      variant={role === 'admin' ? 'solid' : 'flat'}
      color={role === 'admin' ? 'primary' : 'default'}
    >
      {t(role)}
    </Chip>
  );
};

export default RoleChip;
