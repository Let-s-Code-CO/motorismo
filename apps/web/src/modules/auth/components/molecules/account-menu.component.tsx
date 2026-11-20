'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { LogOut, MonitorSmartphone } from 'lucide-react';

import { signOut } from '@web/modules/auth/actions/auth.actions';
import RoleChip from '@web/modules/auth/components/atoms/role-chip.component';
import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';
import type { Audience } from '@web/modules/auth/types/auth.types';
import { initialsOf } from '@web/modules/auth/utils/initials.utils';
import IosInstallSteps from '@web/modules/pwa/components/ios-install-steps.component';
import useInstallPrompt from '@web/modules/pwa/hooks/install-prompt.hook';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { promptInstall } from '@web/modules/pwa/utils/install-prompt.lib';

type AccountMenuProps = {
  name: string;
  /** Google photo, if any (spec 002 CA-30; spec 004 CA-20). */
  avatarUrl: string | null;
  audience: Audience;
};

/**
 * The account on a phone (spec 009, CA-04, RF-02): the avatar opens a menu headed by who is signed
 * in and their role, with «Instalar app» where the app can be installed (spec 006, CA-12 to CA-14)
 * and «Cerrar sesión», so the header keeps only «Menú», the logo and the avatar (CA-01).
 */
const AccountMenu = ({ name, avatarUrl, audience }: AccountMenuProps) => {
  const t = useTranslations();
  const option = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);
  const [, startTransition] = useTransition();

  const onAction = (key: string | number) => {
    if (key === 'install') {
      if (option === 'ios') setShowSteps(true);
      else void promptInstall();
    }
    if (key === 'sign-out') {
      // Through callAction: without network, nothing happens but the «Sin conexión» notice
      // (spec 006, CA-10), instead of an error page.
      startTransition(async () => {
        await callAction(signOut);
      });
    }
  };

  // Only the actions that apply here: «Instalar app» where the app can be installed (CA-04).
  const entries = [...(option ? [{ key: 'install' }] : []), { key: 'sign-out' }];

  const renderEntry = ({ key }: { key: string }) =>
    key === 'install' ? (
      <DropdownItem
        key="install"
        startContent={<MonitorSmartphone aria-hidden className="size-4" />}
      >
        {t('pwa.install.label')}
      </DropdownItem>
    ) : (
      <DropdownItem key="sign-out" startContent={<LogOut aria-hidden className="size-4" />}>
        {t('auth.userMenu.signOut')}
      </DropdownItem>
    );

  return (
    <>
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            isIconOnly
            variant="light"
            radius="full"
            className="size-11"
            // Its name contains what it shows (WCAG 2.5.3): the initials, unless there is a photo.
            aria-label={
              avatarUrl
                ? t('auth.header.accountMenu')
                : t('auth.header.accountMenuOf', { initials: initialsOf(name) })
            }
          >
            <UserAvatar name={name} src={avatarUrl} className="bg-zinc-900 text-white" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label={t('auth.header.accountMenu')}
          items={entries}
          onAction={onAction}
          // Who is signed in heads the menu as text, not as an option: nothing to choose there.
          topContent={
            <span className="flex flex-col items-start gap-1 border-b border-divider px-2 pt-1 pb-3">
              <span className="text-sm font-medium">{name}</span>
              <RoleChip audience={audience} />
            </span>
          }
        >
          {renderEntry}
        </DropdownMenu>
      </Dropdown>
      <IosInstallSteps isOpen={showSteps} onClose={() => setShowSteps(false)} />
    </>
  );
};

export default AccountMenu;
