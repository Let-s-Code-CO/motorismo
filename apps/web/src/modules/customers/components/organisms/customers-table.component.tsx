'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
import { CalendarPlus, ChevronRight, Ellipsis, UserCheck, UserX } from 'lucide-react';

import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';
import { formatMobile } from '@web/modules/core/utils/phone.utils';
import type { CustomerListRow } from '@web/modules/customers/api/customers.server';
import CustomerStatusChip from '@web/modules/customers/components/atoms/customer-status-chip.component';
import {
  type CustomerFilters,
  customerRecordHref,
} from '@web/modules/customers/utils/customers-filter.utils';
import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';

type CustomersTableProps = {
  customers: CustomerListRow[];
  /** Shown when the (possibly filtered or searched) list is empty. */
  emptyLabel: string;
  /**
   * Disables or reactivates a customer (spec 004, RN-09, CA-32): staff, operator or admin. Without
   * it the row actions menu is not drawn.
   */
  onToggleAccess?: (customer: CustomerListRow) => void;
  /** An action is running: the menus wait. */
  isBusy?: boolean;
  /** The list's filter, search and page: each record carries them for its way back (CA-33). */
  listFilters?: CustomerFilters;
};

const WHOLE_LIST: CustomerFilters = { q: '', status: null, page: 1 };

const ICON = 'size-4';

/**
 * Customers with name, email, phone, status and date (spec 004, CA-15); each name opens the
 * record (CA-18). On phones the phone and the status go below the name, nothing behind a scroll.
 * A customer found by a vehicle plate shows that plate under the name (spec 005, CA-19). Each row
 * ends with an actions menu like «Usuarios» (CA-32): for now, disable or reactivate.
 */
const CustomersTable = ({
  customers,
  emptyLabel,
  onToggleAccess,
  isBusy,
  listFilters = WHOLE_LIST,
}: CustomersTableProps) => {
  const t = useTranslations('customers');
  const format = useFormatter();
  const router = useRouter();

  const actionsMenu = (customer: CustomerListRow, toggle: (c: CustomerListRow) => void) => {
    const isDisabled = customer.status === 'disabled';
    const label = t('table.actions', { name: customer.full_name });
    return (
      <div className="flex justify-end">
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button isIconOnly size="sm" variant="light" aria-label={label} isDisabled={isBusy}>
              <Ellipsis aria-hidden className={ICON} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label={label}>
            {isDisabled
              ? [
                  <DropdownItem
                    key="reactivate"
                    startContent={<UserCheck aria-hidden className={ICON} />}
                    onPress={() => toggle(customer)}
                  >
                    {t('detail.reactivate')}
                  </DropdownItem>,
                ]
              : [
                  // Spec 012, CA-42: «Nueva reserva» for this customer.
                  <DropdownItem
                    key="book"
                    startContent={<CalendarPlus aria-hidden className={ICON} />}
                    onPress={() => router.push(`/agenda/new?customer=${customer.id}`)}
                  >
                    {t('detail.book')}
                  </DropdownItem>,
                  <DropdownItem
                    key="disable"
                    color="danger"
                    // Destructive: red like «Desactivar» in «Usuarios»; danger-600 keeps AA contrast.
                    className="text-danger-600"
                    startContent={<UserX aria-hidden className={ICON} />}
                    onPress={() => toggle(customer)}
                  >
                    {t('detail.disable')}
                  </DropdownItem>,
                ]}
          </DropdownMenu>
        </Dropdown>
      </div>
    );
  };

  const columns = [
    <TableColumn key="customer" isRowHeader>
      {t('table.customer')}
    </TableColumn>,
    <TableColumn key="phone" className="hidden md:table-cell">
      {t('table.phone')}
    </TableColumn>,
    <TableColumn key="status" className="hidden sm:table-cell">
      {t('table.status')}
    </TableColumn>,
    <TableColumn key="since" className="hidden lg:table-cell">
      {t('table.since')}
    </TableColumn>,
    ...(onToggleAccess
      ? [
          <TableColumn key="actions" className="w-12">
            <span className="sr-only">{t('table.actionsColumn')}</span>
          </TableColumn>,
        ]
      : []),
  ];

  return (
    <Table
      aria-label={t('table.label')}
      classNames={{
        wrapper: 'rounded-large border border-divider p-0 shadow-small',
        th: 'bg-default-50',
      }}
    >
      <TableHeader>{columns}</TableHeader>
      <TableBody emptyContent={emptyLabel}>
        {customers.map((customer) => {
          const plate = customer.matched_plate;
          const cells = [
            <TableCell key="customer">
              <Link
                href={customerRecordHref(customer.id, listFilters)}
                className="group flex items-center gap-3 rounded-medium outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <UserAvatar
                  name={customer.full_name}
                  src={customer.avatar_url}
                  className="bg-default-100 text-default-700"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1 truncate font-medium group-hover:underline group-hover:underline-offset-4">
                    {customer.full_name}
                    <ChevronRight
                      aria-hidden
                      className="size-3.5 text-default-400 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="truncate text-xs text-default-500">
                    {customer.email ?? t('table.noEmail')}
                  </span>
                  {customer.phone && (
                    <span className="truncate text-xs text-default-500 tabular-nums md:hidden">
                      {formatMobile(customer.phone)}
                    </span>
                  )}
                </span>
                {/* Spec 023, CA-12: the whole plate, on the right of name and email (as in the
                    customer search of «Nueva orden»), without «Placa» in sight (read aloud). */}
                {plate && (
                  <span className="ml-auto flex shrink-0 items-center pl-2">
                    <span className="sr-only">{t('table.plate')}</span>
                    <PlateLabel
                      plate={plate.plate}
                      city={plate.city}
                      legend={plate.legend}
                      size="sm"
                    />
                  </span>
                )}
              </Link>
              <div className="mt-2 pl-11 sm:hidden">
                <CustomerStatusChip status={customer.status} />
              </div>
            </TableCell>,
            <TableCell key="phone" className="hidden text-sm tabular-nums md:table-cell">
              {customer.phone ? formatMobile(customer.phone) : '—'}
            </TableCell>,
            <TableCell key="status" className="hidden sm:table-cell">
              <CustomerStatusChip status={customer.status} />
            </TableCell>,
            <TableCell key="since" className="hidden text-sm text-default-500 lg:table-cell">
              {format.dateTime(new Date(customer.created_at), { dateStyle: 'medium' })}
            </TableCell>,
            ...(onToggleAccess
              ? [
                  <TableCell key="actions">
                    {/* Spec 017, RN-09: an erased customer is final: no actions. */}
                    {customer.erased_at ? null : actionsMenu(customer, onToggleAccess)}
                  </TableCell>,
                ]
              : []),
          ];
          return (
            <TableRow key={customer.id} className="border-b border-divider last:border-none">
              {cells}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default CustomersTable;
