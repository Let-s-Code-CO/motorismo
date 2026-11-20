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

import { formatPesos } from '@web/modules/core/utils/money.utils';
import type { ServiceRow } from '@web/modules/services/api/services.server';

type ServicesTableProps = {
  services: ServiceRow[];
  /** Active services, or the disabled ones (shown apart, with their date). */
  variant: 'active' | 'disabled';
  label: string;
  emptyLabel?: string;
  /** Row actions (an admin, CA-15): without them the actions menu is not drawn. */
  onEdit?: (service: ServiceRow) => void;
  onDisable?: (service: ServiceRow) => void;
  onReactivate?: (service: ServiceRow) => void;
  /** An action is running: the menus wait. */
  isBusy?: boolean;
};

const ICON = 'size-4';
const PRICES = ['price_motorcycle', 'price_car', 'price_bicycle'] as const;
const PRICE_LABEL = {
  price_motorcycle: 'motorcycle',
  price_car: 'car',
  price_bicycle: 'bicycle',
} as const;

/**
 * Services with their reference price per vehicle type (spec 007, HU-01): «$ 25.000», or «No
 * disponible» where the service is not offered (CA-01, CA-02). For an admin each row ends with an
 * actions menu: correct or disable an active service, reactivate a disabled one (CA-05, CA-12,
 * CA-13); an operator only reads (CA-15).
 */
const ServicesTable = ({
  services,
  variant,
  label,
  emptyLabel,
  onEdit,
  onDisable,
  onReactivate,
  isBusy,
}: ServicesTableProps) => {
  const t = useTranslations('services.table');
  const format = useFormatter();
  const hasActions = variant === 'active' ? !!(onEdit || onDisable) : !!onReactivate;
  const priceText = (value: number | null) =>
    value === null ? t('notOffered') : formatPesos(value);

  const actionsMenu = (service: ServiceRow) => {
    const menuLabel = t('actions', { name: service.name });
    const items =
      variant === 'active'
        ? [
            <DropdownItem
              key="edit"
              startContent={<Pencil aria-hidden className={ICON} />}
              onPress={() => onEdit?.(service)}
            >
              {t('edit')}
            </DropdownItem>,
            <DropdownItem
              key="disable"
              color="danger"
              // Destructive: danger-600 keeps AA contrast on white.
              className="text-danger-600"
              startContent={<Ban aria-hidden className={ICON} />}
              onPress={() => onDisable?.(service)}
            >
              {t('disable')}
            </DropdownItem>,
          ]
        : [
            <DropdownItem
              key="reactivate"
              startContent={<ArchiveRestore aria-hidden className={ICON} />}
              onPress={() => onReactivate?.(service)}
            >
              {t('reactivate')}
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
      {t('name')}
    </TableColumn>,
    ...PRICES.map((price) => (
      <TableColumn key={price} className="hidden text-right sm:table-cell">
        {t(PRICE_LABEL[price])}
      </TableColumn>
    )),
    ...(hasActions
      ? [
          <TableColumn key="actions" className="w-12">
            <span className="sr-only">{t('actionsColumn')}</span>
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
        {services.map((service) => {
          const cells = [
            <TableCell key="name">
              <span className="flex flex-col">
                <span className="font-medium break-words">{service.name}</span>
                {/* On phones the prices go under the name: nothing behind a sideways scroll. */}
                <span className="flex flex-col text-xs text-default-500 tabular-nums sm:hidden">
                  {PRICES.map((price) => (
                    <span key={price}>
                      {t(PRICE_LABEL[price])}: {priceText(service[price])}
                    </span>
                  ))}
                </span>
                {variant === 'disabled' && service.disabled_at && (
                  <span className="text-xs text-default-500">
                    {t('disabledOn', {
                      date: format.dateTime(new Date(service.disabled_at), { dateStyle: 'long' }),
                    })}
                  </span>
                )}
              </span>
            </TableCell>,
            ...PRICES.map((price) => {
              const value = service[price];
              return (
                <TableCell
                  key={price}
                  className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell"
                >
                  {value === null ? (
                    <span className="text-xs text-default-500">{t('notOffered')}</span>
                  ) : (
                    formatPesos(value)
                  )}
                </TableCell>
              );
            }),
            ...(hasActions ? [<TableCell key="actions">{actionsMenu(service)}</TableCell>] : []),
          ];
          return <TableRow key={service.id}>{cells}</TableRow>;
        })}
      </TableBody>
    </Table>
  );
};

export default ServicesTable;
