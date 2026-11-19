'use client';

import type { ReactElement } from 'react';

import { useTranslations } from 'next-intl';

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';
import { Ellipsis, Send, ShieldCheck, UserCheck, UserRound, UserX } from 'lucide-react';

import RoleChip from '@web/modules/auth/components/atoms/role-chip.component';
import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';
import type { CurrentUser, UserRole } from '@web/modules/auth/types/auth.types';
import StatusChip from '@web/modules/users/components/molecules/status-chip.component';

type UserRow = Pick<CurrentUser, 'id' | 'full_name' | 'email' | 'role' | 'status' | 'avatar_url'>;

type UsersTableProps = {
  users: UserRow[];
  /** The signed-in admin: their own row offers no role or status change (CA-10). */
  currentUserId: string;
  onResend: (userId: string) => void;
  onChangeRole: (userId: string, role: UserRole) => void;
  onChangeStatus: (userId: string, status: 'active' | 'disabled') => void;
  isBusy?: boolean;
  /** Shown when the (possibly filtered) list is empty. */
  emptyLabel?: string;
};

const ICON = 'size-4 shrink-0';

/**
 * Every user with name, email, role and status (CA-17), and the admin's actions on OTHER users,
 * grouped in a menu per row (spec 003, CA-07): resend invitation (CA-16), change role (CA-18),
 * disable / reactivate (CA-19, CA-20, CA-29).
 */
const UsersTable = ({
  users,
  currentUserId,
  onResend,
  onChangeRole,
  onChangeStatus,
  isBusy = false,
  emptyLabel,
}: UsersTableProps) => {
  const t = useTranslations('users');
  const activeAdmins = users.filter(({ role, status }) => role === 'admin' && status === 'active');
  const isOnlyActiveAdmin = activeAdmins.length === 1 && activeAdmins[0]?.id === currentUserId;

  const actionsFor = (user: UserRow) => {
    if (user.id === currentUserId) {
      return (
        <div className="ml-auto flex w-max max-w-44 flex-col items-end text-right text-xs text-default-500">
          <span className="font-medium whitespace-nowrap">{t('table.self')}</span>
          {isOnlyActiveAdmin && <span>{t('table.lastAdmin')}</span>}
        </div>
      );
    }

    type Action = {
      key: string;
      label: string;
      icon: ReactElement;
      danger?: boolean;
      run: () => void;
    };
    const nextRole: UserRole = user.role === 'admin' ? 'operator' : 'admin';
    const actions: Action[] = [
      ...(user.status === 'invited'
        ? [
            {
              key: 'resend',
              label: t('actions.resend'),
              icon: <Send aria-hidden className={ICON} />,
              run: () => onResend(user.id),
            },
          ]
        : []),
      ...(user.status !== 'disabled'
        ? [
            {
              key: 'role',
              label: nextRole === 'admin' ? t('actions.makeAdmin') : t('actions.makeOperator'),
              icon:
                nextRole === 'admin' ? (
                  <ShieldCheck aria-hidden className={ICON} />
                ) : (
                  <UserRound aria-hidden className={ICON} />
                ),
              run: () => onChangeRole(user.id, nextRole),
            },
          ]
        : []),
      user.status === 'disabled'
        ? {
            key: 'reactivate',
            label: t('actions.reactivate'),
            icon: <UserCheck aria-hidden className={ICON} />,
            run: () => onChangeStatus(user.id, 'active'),
          }
        : {
            key: 'disable',
            label: t('actions.disable'),
            icon: <UserX aria-hidden className={ICON} />,
            danger: true,
            run: () => onChangeStatus(user.id, 'disabled'),
          },
    ];

    const label = t('actions.menu', { name: user.full_name });
    return (
      <div className="flex justify-end">
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button isIconOnly size="sm" variant="light" aria-label={label} isDisabled={isBusy}>
              <Ellipsis aria-hidden className="size-4" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label={label} items={actions}>
            {(action) => (
              <DropdownItem
                key={action.key}
                startContent={action.icon}
                color={action.danger ? 'danger' : 'default'}
                className={action.danger ? 'text-danger' : undefined}
                onPress={action.run}
              >
                {action.label}
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>
      </div>
    );
  };

  return (
    <Table
      aria-label={t('table.label')}
      classNames={{
        wrapper: 'rounded-large border border-divider p-0 shadow-small',
        th: 'bg-default-50',
      }}
    >
      <TableHeader>
        <TableColumn isRowHeader>{t('table.user')}</TableColumn>
        <TableColumn align="end" className="w-px">
          {t('table.actions')}
        </TableColumn>
      </TableHeader>
      <TableBody emptyContent={emptyLabel ?? t('table.empty')}>
        {users.map((user) => (
          <TableRow key={user.id} className="border-b border-divider last:border-none">
            <TableCell>
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={user.full_name}
                  src={user.avatar_url}
                  className="bg-default-100 text-default-700"
                />
                {/* Role and status sit beside the name on desktop and below it on phones, so
                    nothing is hidden behind a horizontal scroll. */}
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{user.full_name}</span>
                    <span className="truncate text-xs text-default-500">{user.email}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RoleChip audience={user.role} />
                    <StatusChip status={user.status} />
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>{actionsFor(user)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default UsersTable;
