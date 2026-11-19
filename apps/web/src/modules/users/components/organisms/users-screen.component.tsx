'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { Button, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from '@heroui/react';

import type { CurrentUser, UserRole } from '@web/modules/auth/types/auth.types';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  type UsersErrorKey,
  changeRole,
  resendInvite,
  setUserStatus,
} from '@web/modules/users/actions/users.actions';
import InviteUserForm from '@web/modules/users/components/organisms/invite-user-form.component';
import UsersTable from '@web/modules/users/components/organisms/users-table.component';

type Notice = { tone: 'success' | 'danger'; text: string };

type UsersScreenProps = {
  users: Pick<CurrentUser, 'id' | 'full_name' | 'email' | 'role' | 'status'>[];
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
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button color="primary" onPress={onOpen}>
          {t('inviteButton')}
        </Button>
      </div>

      {notice && (
        <p
          role="status"
          className={`rounded-medium px-3 py-2 text-sm ${
            notice.tone === 'success'
              ? 'bg-success-50 text-success-700'
              : 'bg-danger-50 text-danger'
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

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalHeader>{t('invite.title')}</ModalHeader>
          <ModalBody className="pb-6">
            <InviteUserForm onInvited={handleInvited} />
          </ModalBody>
        </ModalContent>
      </Modal>
    </section>
  );
};

export default UsersScreen;
