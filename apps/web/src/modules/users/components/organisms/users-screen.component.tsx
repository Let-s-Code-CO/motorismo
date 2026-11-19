'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { Button, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from '@heroui/react';
import { UserPlus } from 'lucide-react';

import type { CurrentUser, UserRole } from '@web/modules/auth/types/auth.types';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  type UsersErrorKey,
  changeRole,
  resendInvite,
  setUserStatus,
} from '@web/modules/users/actions/users.actions';
import UsersSummary from '@web/modules/users/components/molecules/users-summary.component';
import InviteUserForm from '@web/modules/users/components/organisms/invite-user-form.component';
import UsersTable from '@web/modules/users/components/organisms/users-table.component';

type Notice = { tone: 'success' | 'danger'; text: string };

type UsersScreenProps = {
  users: Pick<CurrentUser, 'id' | 'full_name' | 'email' | 'role' | 'status' | 'avatar_url'>[];
  currentUserId: string;
};

/** User management for admins: list, invite, resend, change role, disable (HU-03, HU-04). */
const UsersScreen = ({ users, currentUserId }: UsersScreenProps) => {
  const t = useTranslations('users');
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [notice, setNotice] = useState<Notice>();
  const [isPending, startTransition] = useTransition();

  const handleInvited = (email: string) => {
    onClose();
    setNotice({ tone: 'success', text: t('invited', { email }) });
  };

  const run = (action: () => Promise<ActionResult<UsersErrorKey>>, successKey: string) => {
    startTransition(async () => {
      const result = await action();
      setNotice(
        result.ok
          ? { tone: 'success', text: t(successKey) }
          : { tone: 'danger', text: t(`errors.${result.error}`) }
      );
    });
  };

  const handleResend = (userId: string) => run(() => resendInvite(userId), 'resent');
  const handleChangeRole = (userId: string, role: UserRole) =>
    run(() => changeRole({ userId, role }), 'roleChanged');
  const handleChangeStatus = (userId: string, status: 'active' | 'disabled') =>
    run(
      () => setUserStatus({ userId, status }),
      status === 'disabled' ? 'disabled' : 'reactivated'
    );

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-default-500">{t('description')}</p>
        </div>
        <Button
          color="primary"
          className="font-medium"
          startContent={<UserPlus aria-hidden className="size-4" />}
          onPress={onOpen}
        >
          {t('inviteButton')}
        </Button>
      </div>

      <UsersSummary users={users} />

      {notice && (
        <p
          role="status"
          className={`rounded-large border px-4 py-3 text-sm ${
            notice.tone === 'success'
              ? 'border-success-200 bg-success-50 text-success-800'
              : 'border-danger-200 bg-danger-50 text-danger-700'
          }`}
        >
          {notice.text}
        </p>
      )}

      <UsersTable
        users={users}
        currentUserId={currentUserId}
        onResend={handleResend}
        onChangeRole={handleChangeRole}
        onChangeStatus={handleChangeStatus}
        isBusy={isPending}
      />

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" backdrop="blur">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-lg font-semibold tracking-tight">{t('invite.title')}</span>
            <span className="text-sm font-normal text-default-500">{t('invite.description')}</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <InviteUserForm onInvited={handleInvited} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </section>
  );
};

export default UsersScreen;
