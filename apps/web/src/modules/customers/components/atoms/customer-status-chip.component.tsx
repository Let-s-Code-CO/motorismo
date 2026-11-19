'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';

import type { CustomerStatus } from '@web/modules/auth/types/auth.types';

const COLOR = { registered: 'success', walk_in: 'warning', disabled: 'default' } as const;

/** «Con cuenta», «Sin cuenta» or «Desactivado» (spec 004). */
const CustomerStatusChip = ({ status }: { status: CustomerStatus }) => {
  const t = useTranslations('customers.status');

  return (
    <Chip size="sm" variant="dot" color={COLOR[status]}>
      {t(status)}
    </Chip>
  );
};

export default CustomerStatusChip;
