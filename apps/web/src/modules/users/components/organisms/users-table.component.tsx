'use client';

import { useTranslations } from 'next-intl';

import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react';

import RoleChip from '@web/modules/auth/components/atoms/role-chip.component';
import type { CurrentUser, UserRole } from '@web/modules/auth/types/auth.types';
import StatusChip from '@web/modules/users/components/molecules/status-chip.component';

type UserRow = Pick<CurrentUser, 'id' | 'full_name' | 'email' | 'role' | 'status'>;

type UsersTableProps = {
  users: UserRow[];
  /** The signed-in admin: their own row offers no role or status change (CA-10). */
  currentUserId: string;
  onResend: (userId: string) => void;
  onChangeRole: (userId: string, role: UserRole) => void;
  onChangeStatus: (userId: string, status: 'active' | 'disabled') => void;
  isBusy?: boolean;
};

/**
 * Every user with name, email, role and status (CA-17), and the admin's actions on OTHER users:
 * resend invitation (CA-16), change role (CA-18), disable / reactivate (CA-19, CA-20).
 */
const UsersTable = ({
  users,
  currentUserId,
  onResend,
  onChangeRole,
  onChangeStatus,
  isBusy = false,
}: UsersTableProps) => {
  const t = useTranslations('users');
  const activeAdmins = users.filter(({ role, status }) => role === 'admin' && status === 'active');
  const isOnlyActiveAdmin = activeAdmins.length === 1 && activeAdmins[0]?.id === currentUserId;

  const actionsFor = (user: UserRow) => {
    if (user.id === currentUserId) {
      return (
        <div className="flex flex-col text-xs text-default-500">
          <span>{t('table.self')}</span>
          {isOnlyActiveAdmin && <span>{t('table.lastAdmin')}</span>}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {user.status === 'invited' && (
          <Button size="sm" variant="flat" isDisabled={isBusy} onPress={() => onResend(user.id)}>
            {t('actions.resend')}
          </Button>
        )}
        {user.status !== 'disabled' && (
          <Button
            size="sm"
            variant="flat"
            isDisabled={isBusy}
            onPress={() => onChangeRole(user.id, user.role === 'admin' ? 'operator' : 'admin')}
          >
            {user.role === 'admin' ? t('actions.makeOperator') : t('actions.makeAdmin')}
          </Button>
        )}
        {user.status === 'disabled' ? (
          <Button
            size="sm"
            variant="flat"
            color="success"
            isDisabled={isBusy}
            onPress={() => onChangeStatus(user.id, 'active')}
          >
            {t('actions.reactivate')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="flat"
            color="danger"
            isDisabled={isBusy}
            onPress={() => onChangeStatus(user.id, 'disabled')}
          >
            {t('actions.disable')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Table aria-label={t('table.label')}>
      <TableHeader>
        <TableColumn isRowHeader>{t('table.name')}</TableColumn>
        <TableColumn>{t('table.email')}</TableColumn>
        <TableColumn>{t('table.role')}</TableColumn>
        <TableColumn>{t('table.status')}</TableColumn>
        <TableColumn>{t('table.actions')}</TableColumn>
      </TableHeader>
      <TableBody emptyContent={t('table.empty')}>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>{user.full_name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <RoleChip role={user.role} />
            </TableCell>
            <TableCell>
              <StatusChip status={user.status} />
            </TableCell>
            <TableCell>{actionsFor(user)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default UsersTable;
