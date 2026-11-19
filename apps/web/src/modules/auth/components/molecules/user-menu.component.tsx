'use client';

import { useTranslations } from 'next-intl';

import { Button, Tooltip } from '@heroui/react';
import { LogOut } from 'lucide-react';

import { signOut } from '@web/modules/auth/actions/auth.actions';
import RoleChip from '@web/modules/auth/components/atoms/role-chip.component';
import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';
import type { CurrentUser } from '@web/modules/auth/types/auth.types';

type UserMenuProps = {
  user: Pick<CurrentUser, 'full_name' | 'role' | 'avatar_url'>;
};

/** Who is signed in, with which role, and how to leave (RF-05). */
const UserMenu = ({ user }: UserMenuProps) => {
  const t = useTranslations('auth.userMenu');

  return (
    <div className="flex items-center gap-3">
      <UserAvatar name={user.full_name} src={user.avatar_url} className="bg-zinc-900 text-white" />
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
