'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@heroui/react';

import { signOut } from '@web/modules/auth/actions/auth.actions';
import RoleChip from '@web/modules/auth/components/atoms/role-chip.component';
import type { CurrentUser } from '@web/modules/auth/types/auth.types';

type UserMenuProps = {
  user: Pick<CurrentUser, 'full_name' | 'role'>;
};

/** Who is signed in, with which role, and how to leave (RF-05). */
const UserMenu = ({ user }: UserMenuProps) => {
  const t = useTranslations('auth.userMenu');

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col items-end gap-1">
        <span className="text-sm font-medium">{user.full_name}</span>
        <RoleChip role={user.role} />
      </div>
      <form action={signOut}>
        <Button type="submit" size="sm" variant="flat">
          {t('signOut')}
        </Button>
      </form>
    </div>
  );
};

export default UserMenu;
