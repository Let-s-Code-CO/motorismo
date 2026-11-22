'use client';

import { useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button, Modal, ModalBody, ModalContent, ModalHeader, useDisclosure } from '@heroui/react';
import { UserPlus } from 'lucide-react';

import { Constants } from '@motorismo/supabase/types';

import type { CurrentUser, UserRole, UserStatus } from '@web/modules/auth/types/auth.types';
import FilterBar from '@web/modules/core/components/filter-bar.component';
import SummaryFilterCards from '@web/modules/core/components/summary-filter-cards.component';
import { notify } from '@web/modules/core/lib/toast.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { filterByStatus, parseStatusParam } from '@web/modules/core/utils/status-filter.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import {
  type UsersErrorKey,
  changeRole,
  resendInvite,
  setUserStatus,
} from '@web/modules/users/actions/users.actions';
import InviteUserForm from '@web/modules/users/components/organisms/invite-user-form.component';
import UsersTable from '@web/modules/users/components/organisms/users-table.component';

/** Summary cards = filters (project standard): order and status dot of each card. */
const SUMMARY: { status: UserStatus; dot: string }[] = [
  { status: 'active', dot: 'bg-success' },
  { status: 'invited', dot: 'bg-warning' },
  { status: 'disabled', dot: 'bg-default-400' },
];

type UsersScreenProps = {
  users: Pick<CurrentUser, 'id' | 'full_name' | 'email' | 'role' | 'status' | 'avatar_url'>[];
  currentUserId: string;
};

/** User management for admins: list, invite, resend, change role, disable (HU-03, HU-04). */
const UsersScreen = ({ users, currentUserId }: UsersScreenProps) => {
  const t = useTranslations('users');
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [isPending, startTransition] = useTransition();

  // The status filter lives in the URL: it survives a reload and works with "back" (CA-09).
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = parseStatusParam(searchParams.get('status'), Constants.public.Enums.user_status);
  const visibleUsers = filterByStatus(users, status);

  const setStatus = (next: UserStatus | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set('status', next);
    else params.delete('status');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleInvited = (email: string) => {
    onClose();
    notify({ tone: 'success', text: t('invited', { email }) });
  };

  const run = (action: () => Promise<ActionResult<UsersErrorKey>>, successKey: string) => {
    startTransition(async () => {
      const result = await callAction(action);
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      // Spec 013: a floating notice, where it is seen; a refusal stays until closed (CA-07).
      notify(
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

      <SummaryFilterCards
        label={t('summary.filterLabel')}
        options={SUMMARY.map(({ status: value, dot }) => ({
          value,
          dot,
          label: t(`summary.${value}`),
          count: users.filter((user) => user.status === value).length,
        }))}
        selected={status}
        onSelect={setStatus}
      />

      <div className="flex flex-col gap-3">
        <FilterBar
          text={
            status
              ? t('filter.shown', {
                  shown: visibleUsers.length,
                  total: users.length,
                  status: t(`summary.${status}`),
                })
              : t('filter.total', { count: users.length })
          }
          showReset={status !== null}
          onReset={() => setStatus(null)}
        />
        <UsersTable
          users={visibleUsers}
          emptyLabel={status ? t('table.emptyFiltered') : t('table.empty')}
          currentUserId={currentUserId}
          onResend={handleResend}
          onChangeRole={handleChangeRole}
          onChangeStatus={handleChangeStatus}
          isBusy={isPending}
        />
      </div>

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
