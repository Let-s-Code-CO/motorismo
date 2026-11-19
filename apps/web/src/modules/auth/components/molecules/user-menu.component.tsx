'use client';

import { useTranslations } from 'next-intl';

import { Avatar, Button, Tooltip } from '@heroui/react';
import { LogOut } from 'lucide-react';

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
      <Avatar
        name={user.full_name}
        size="sm"
        className="bg-zinc-900 text-xs font-medium text-white"
        aria-hidden
      />
      <div className="hidden flex-col items-start gap-0.5 sm:flex">
        <span className="text-sm leading-none font-medium">{user.full_name}</span>
        <RoleChip role={user.role} />
      </div>
      <form action={signOut}>
        <Tooltip content={t('signOut')} placement="bottom">
          <Button type="submit" isIconOnly size="sm" variant="light" aria-label={t('signOut')}>
            <LogOut aria-hidden className="size-4" />
          </Button>
        </Tooltip>
      </form>
    </div>
  );
};

export default UserMenu;
