'use client';

import { useTranslations } from 'next-intl';

import { Button, Tooltip } from '@heroui/react';
import { LogOut } from 'lucide-react';

import { signOut } from '@web/modules/auth/actions/auth.actions';
import RoleChip from '@web/modules/auth/components/atoms/role-chip.component';
import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';
import type { Audience } from '@web/modules/auth/types/auth.types';
import InstallAppButton from '@web/modules/pwa/components/install-app-button.component';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';

type UserMenuProps = {
  name: string;
  /** Google photo, if any (spec 002 CA-30; spec 004 CA-20). */
  avatarUrl: string | null;
  audience: Audience;
};

/**
 * Who is signed in, with which role (or "Cliente"), and how to leave (RF-05); and «Instalar app»
 * when the app can be installed here (spec 006, HU-03).
 */
const UserMenu = ({ name, avatarUrl, audience }: UserMenuProps) => {
  const t = useTranslations('auth.userMenu');

  return (
    <div className="flex items-center gap-1 sm:gap-3">
      <UserAvatar name={name} src={avatarUrl} className="bg-zinc-900 text-white" />
      <div className="hidden flex-col items-start gap-0.5 sm:flex">
        <span className="text-sm leading-none font-medium">{name}</span>
        <RoleChip audience={audience} />
      </div>
      <InstallAppButton />
      {/* Through callAction: without network, nothing happens but the «Sin conexión» notice
          (spec 006, CA-10), instead of an error page. */}
      <form
        action={async () => {
          await callAction(signOut);
        }}
      >
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
