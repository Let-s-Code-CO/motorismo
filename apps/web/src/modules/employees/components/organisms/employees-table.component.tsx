'use client';

import { useFormatter, useTranslations } from 'next-intl';

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
import { ArchiveRestore, Ban, Ellipsis, Pencil } from 'lucide-react';

import { formatMobile } from '@web/modules/core/utils/phone.utils';
import type { EmployeeRow } from '@web/modules/employees/api/employees.server';

type EmployeesTableProps = {
  employees: EmployeeRow[];
  /** Active employees, or the disabled ones (shown apart, with their date). */
  variant: 'active' | 'disabled';
  label: string;
  emptyLabel?: string;
  /** An admin sees the document, phone and commission (RN-07); an operator only the names. */
  showDetails: boolean;
  /** Row actions (an admin): without them the actions menu is not drawn. */
  onEdit?: (employee: EmployeeRow) => void;
  onDisable?: (employee: EmployeeRow) => void;
  onReactivate?: (employee: EmployeeRow) => void;
  isBusy?: boolean;
};

const ICON = 'size-4';

/**
 * Employees by name (spec 007, HU-02). An admin sees each one's document, phone and commission and
 * can correct, disable or reactivate (CA-10, CA-12, CA-13); an operator sees only the names of the
 * active ones (CA-16).
 */
const EmployeesTable = ({
  employees,
  variant,
  label,
  emptyLabel,
  showDetails,
  onEdit,
  onDisable,
  onReactivate,
  isBusy,
}: EmployeesTableProps) => {
  const t = useTranslations('employees');
  const format = useFormatter();
  const hasActions = variant === 'active' ? !!(onEdit || onDisable) : !!onReactivate;

  const actionsMenu = (employee: EmployeeRow) => {
    const menuLabel = t('table.actions', { name: employee.full_name });
    const items =
      variant === 'active'
        ? [
            <DropdownItem
              key="edit"
              startContent={<Pencil aria-hidden className={ICON} />}
              onPress={() => onEdit?.(employee)}
            >
              {t('table.edit')}
            </DropdownItem>,
            <DropdownItem
              key="disable"
              color="danger"
              // Destructive: danger-600 keeps AA contrast on white.
              className="text-danger-600"
              startContent={<Ban aria-hidden className={ICON} />}
              onPress={() => onDisable?.(employee)}
            >
              {t('table.disable')}
            </DropdownItem>,
          ]
        : [
            <DropdownItem
              key="reactivate"
              startContent={<ArchiveRestore aria-hidden className={ICON} />}
              onPress={() => onReactivate?.(employee)}
            >
              {t('table.reactivate')}
            </DropdownItem>,
          ];
    return (
      <div className="flex justify-end">
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button isIconOnly size="sm" variant="light" aria-label={menuLabel} isDisabled={isBusy}>
              <Ellipsis aria-hidden className={ICON} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label={menuLabel}>{items}</DropdownMenu>
        </Dropdown>
      </div>
    );
  };

  const columns = [
    <TableColumn key="name" isRowHeader>
      {t('table.name')}
    </TableColumn>,
    ...(showDetails
      ? [
          <TableColumn key="document" className="hidden sm:table-cell">
            {t('table.document')}
          </TableColumn>,
          <TableColumn key="phone" className="hidden md:table-cell">
            {t('table.phone')}
          </TableColumn>,
          <TableColumn key="commission" className="text-right">
            {t('table.commission')}
          </TableColumn>,
        ]
      : []),
    ...(hasActions
      ? [
          <TableColumn key="actions" className="w-12">
            <span className="sr-only">{t('table.actionsColumn')}</span>
          </TableColumn>,
        ]
      : []),
  ];

  return (
    <Table
      aria-label={label}
      classNames={{
        wrapper: 'rounded-large border border-divider p-0 shadow-small',
        th: 'bg-default-50',
      }}
    >
      <TableHeader>{columns}</TableHeader>
      <TableBody emptyContent={emptyLabel}>
        {employees.map((employee) => {
          const { details } = employee;
          const document = details
            ? `${t(`documentShort.${details.document_type}`)} ${details.document_number}`
            : '';
          const phone = details?.phone ? formatMobile(details.phone) : t('table.noPhone');
          const cells = [
            <TableCell key="name">
              <span className="flex flex-col">
                <span className="font-medium break-words">{employee.full_name}</span>
                {/* On phones the document goes under the name: nothing behind a scroll. */}
                {showDetails && (
                  <span className="text-xs text-default-500 tabular-nums sm:hidden">
                    {document}
                  </span>
                )}
                {variant === 'disabled' && employee.disabled_at && (
                  <span className="text-xs text-default-500">
                    {t('table.disabledOn', {
                      date: format.dateTime(new Date(employee.disabled_at), { dateStyle: 'long' }),
                    })}
                  </span>
                )}
              </span>
            </TableCell>,
            ...(showDetails
              ? [
                  <TableCell key="document" className="hidden tabular-nums sm:table-cell">
                    {document}
                  </TableCell>,
                  <TableCell key="phone" className="hidden tabular-nums md:table-cell">
                    {phone}
                  </TableCell>,
                  <TableCell key="commission" className="text-right tabular-nums">
                    {details ? t('table.commissionValue', { value: details.commission_pct }) : ''}
                  </TableCell>,
                ]
              : []),
            ...(hasActions ? [<TableCell key="actions">{actionsMenu(employee)}</TableCell>] : []),
          ];
          return <TableRow key={employee.id}>{cells}</TableRow>;
        })}
      </TableBody>
    </Table>
  );
};

export default EmployeesTable;
