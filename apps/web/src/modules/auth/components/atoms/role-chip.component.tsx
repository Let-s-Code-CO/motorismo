'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';

import type { Audience } from '@web/modules/auth/types/auth.types';

/** The role of a staff member, or "Cliente" (spec 004). */
const RoleChip = ({ audience }: { audience: Audience }) => {
  const t = useTranslations('auth.roles');

  return (
    <Chip
      size="sm"
      radius="sm"
      variant={audience === 'admin' ? 'solid' : 'flat'}
      color={audience === 'admin' ? 'primary' : 'default'}
    >
      {t(audience)}
    </Chip>
  );
};

export default RoleChip;
