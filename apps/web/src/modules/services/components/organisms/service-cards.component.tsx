'use client';

import { type ReactNode, useId } from 'react';

import { useFormatter, useTranslations } from 'next-intl';

import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { ArchiveRestore, Ban, Clock, Ellipsis, Pencil } from 'lucide-react';

import useDuration from '@web/modules/core/hooks/duration.hook';
import { formatPesos } from '@web/modules/core/utils/money.utils';
import type { ServiceRow } from '@web/modules/services/api/services.server';
import { MOTORCYCLE_CATEGORIES } from '@web/modules/vehicles/constants/motorcycle-categories.constants';

type ServiceCardsProps = {
  services: ServiceRow[];
  /** Active services (in groups), or the disabled ones (one list, with their date). */
  variant: 'active' | 'disabled';
  /** The name of the whole set («Servicios activos»). */
  label: string;
  emptyLabel?: string;
  /** Card actions (an admin, CA-15): without them the actions menu is not drawn. */
  onEdit?: (service: ServiceRow) => void;
  onDisable?: (service: ServiceRow) => void;
  onReactivate?: (service: ServiceRow) => void;
  /** An action is running: the menus wait. */
  isBusy?: boolean;
};

type Group = 'byCategory' | 'single' | 'onQuote';

const GROUPS: Group[] = ['byCategory', 'single', 'onQuote'];
const ICON = 'size-4';
const PRICES = [
  ['price_motorcycle', 'motorcycle'],
  ['price_car', 'car'],
  ['price_bicycle', 'bicycle'],
] as const;
/** A small label above a figure: mono, upper case and spaced, like the table headers. */
const EYEBROW = 'font-mono text-[11px] tracking-wider text-default-500 uppercase';

/** The lowest value of a service by category, to order the packages. */
const lowest = (service: ServiceRow) => Math.min(...Object.values(service.motorcycle_prices ?? {}));

const groupOf = (service: ServiceRow): Group => {
  if (service.on_quote) return 'onQuote';
  return service.motorcycle_prices ? 'byCategory' : 'single';
};

/**
 * The services as cards (spec 007, HU-01; spec 024): name, what it includes (CA-19), its usual time
 * (spec 008, CA-26) and, at the bottom, its values. The active ones go in three groups (spec 024,
 * CA-09): the packages by motorcycle category, from the cheapest up, with their range and their
 * eight values; those with
 * a single value, with the value of each vehicle type they are offered for (CA-01, CA-02); and those
 * «a convenir» (CA-12). For an admin each card has an actions menu: correct or disable an active
 * service, reactivate a disabled one (CA-05, CA-12, CA-13); an operator only reads (CA-15).
 */
const ServiceCards = ({
  services,
  variant,
  label,
  emptyLabel,
  onEdit,
  onDisable,
  onReactivate,
  isBusy,
}: ServiceCardsProps) => {
  const t = useTranslations('services.cards');
  const hasActions = variant === 'active' ? !!(onEdit || onDisable) : !!onReactivate;
  const groupId = useId();

  if (services.length === 0)
    return (
      <p className="rounded-large border border-dashed border-divider p-8 text-center text-default-500">
        {emptyLabel}
      </p>
    );

  const cards = (list: ServiceRow[]) =>
    list.map((service) => (
      <li key={service.id} className="flex">
        <ServiceCard
          service={service}
          variant={variant}
          actions={
            hasActions ? (
              <ActionsMenu
                service={service}
                variant={variant}
                isBusy={isBusy}
                onEdit={onEdit}
                onDisable={onDisable}
                onReactivate={onReactivate}
              />
            ) : null
          }
        />
      </li>
    ));
  const grid = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3';
  // The packages side by side on a wide screen, as a price list.
  const packagesGrid = 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4';

  if (variant === 'disabled')
    return (
      <ul aria-label={label} className={grid}>
        {cards(services)}
      </ul>
    );

  return (
    <section aria-label={label} className="flex flex-col gap-10">
      {GROUPS.map((group) => {
        const inGroup = services.filter((service) => groupOf(service) === group);
        // The packages from the cheapest up (Pro Wash, Premium, Deluxe, Supreme); the rest by name.
        if (group === 'byCategory') inGroup.sort((a, b) => lowest(a) - lowest(b));
        if (inGroup.length === 0) return null;
        const headingId = `${groupId}-${group}`;
        return (
          <section key={group} aria-labelledby={headingId} className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 id={headingId} className="text-lg font-semibold tracking-tight">
                {t(`groups.${group}`)}
              </h2>
              <p className="text-sm text-default-500">{t(`groups.${group}Hint`)}</p>
            </div>
            <ul
              aria-labelledby={headingId}
              className={group === 'byCategory' ? packagesGrid : grid}
            >
              {cards(inGroup)}
            </ul>
          </section>
        );
      })}
    </section>
  );
};

type ServiceCardProps = {
  service: ServiceRow;
  variant: 'active' | 'disabled';
  actions: ReactNode;
};

const ServiceCard = ({ service, variant, actions }: ServiceCardProps) => {
  const t = useTranslations('services.cards');
  const tv = useTranslations('vehicles');
  const format = useFormatter();
  const duration = useDuration();
  const nameId = useId();
  const offered = PRICES.flatMap(([price, type]) => {
    const value = service[price];
    return value === null ? [] : [{ type, value }];
  });

  const values = () => {
    // Spec 024, CA-12: agreed in each order.
    if (service.on_quote)
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-semibold tracking-tight">{t('onQuote')}</span>
          <span className="text-sm text-default-500">{t('onQuoteNote')}</span>
        </div>
      );
    // Spec 024, CA-09: the range, then each category.
    if (service.motorcycle_prices) {
      const prices = service.motorcycle_prices;
      const all = Object.values(prices);
      const [low, high] = [Math.min(...all), Math.max(...all)];
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className={EYEBROW}>{t('rangeLabel')}</span>
            {/* Words and figures on one line: Geist with aligned figures, never cut. */}
            <span className="text-lg font-semibold tracking-tight whitespace-nowrap tabular-figures">
              {low === high
                ? formatPesos(low)
                : t('range', { from: formatPesos(low), to: formatPesos(high) })}
            </span>
          </div>
          {/* Two columns of label over value: nothing is cut nor wraps. */}
          <ul
            aria-label={t('byCategory', { name: service.name })}
            className="grid grid-cols-2 gap-x-4 border-t border-divider"
          >
            {MOTORCYCLE_CATEGORIES.map((category) => (
              <li
                key={category}
                className="flex flex-col border-b border-divider py-2 whitespace-nowrap"
              >
                <span className="text-xs text-default-500">{tv(`categories.${category}`)}</span>
                <span className="text-sm font-medium tabular-nums">
                  {formatPesos(prices[category])}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    // CA-01, CA-02: the value of each type it is offered for.
    return (
      <ul aria-label={t('prices', { name: service.name })} className="flex flex-col gap-1">
        {offered.map(({ type, value }) => (
          <li key={type} className="flex items-baseline justify-between gap-3">
            <span className={EYEBROW}>{t(`types.${type}`)}</span>
            <span className="text-xl font-semibold tracking-tight tabular-nums">
              {formatPesos(value)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <article
      aria-labelledby={nameId}
      className="flex w-full flex-col gap-4 rounded-large border border-divider bg-content1 p-5 shadow-small"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={nameId} className="text-base font-semibold tracking-tight break-words">
            {service.name}
          </h3>
          {/* Spec 024, CA-21: the services it includes. */}
          {service.includes.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">{t('includes')}</span>{' '}
              {service.includes.map(({ name }) => name).join(', ')}
            </p>
          )}
          {/* Spec 024, CA-19: what else it includes, in two lines at most. */}
          {service.description && (
            <p className="line-clamp-2 text-sm text-default-500" title={service.description}>
              {service.description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {(service.estimated_minutes != null || (variant === 'disabled' && service.disabled_at)) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-default-500">
          {/* Spec 008, CA-26: how long it usually takes. */}
          {service.estimated_minutes != null && (
            <span className="flex items-center gap-1 tabular-figures">
              <Clock aria-hidden className="size-3.5" />
              {t('duration', { duration: duration(service.estimated_minutes) })}
            </span>
          )}
          {variant === 'disabled' && service.disabled_at && (
            <span>
              {t('disabledOn', {
                date: format.dateTime(new Date(service.disabled_at), { dateStyle: 'long' }),
              })}
            </span>
          )}
        </div>
      )}
      <div className="mt-auto">{values()}</div>
    </article>
  );
};

type ActionsMenuProps = Pick<
  ServiceCardsProps,
  'variant' | 'isBusy' | 'onEdit' | 'onDisable' | 'onReactivate'
> & { service: ServiceRow };

const ActionsMenu = ({
  service,
  variant,
  isBusy,
  onEdit,
  onDisable,
  onReactivate,
}: ActionsMenuProps) => {
  const t = useTranslations('services.cards');
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
    <Dropdown placement="bottom-end" classNames={{ trigger: 'aria-expanded:opacity-100' }}>
      <DropdownTrigger>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          className="-me-2 -mt-1 shrink-0"
          aria-label={menuLabel}
          isDisabled={isBusy}
        >
          <Ellipsis aria-hidden className={ICON} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label={menuLabel}>{items}</DropdownMenu>
    </Dropdown>
  );
};

export default ServiceCards;
