'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
} from '@heroui/react';
import { ChevronDown, EllipsisVertical, Plus, Search } from 'lucide-react';

import FilterBar from '@web/modules/core/components/filter-bar.component';
import SummaryFilterCards from '@web/modules/core/components/summary-filter-cards.component';
import useUrlFilters from '@web/modules/core/hooks/url-filters.hook';
import { notify } from '@web/modules/core/lib/toast.lib';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import {
  markVehicleBrandReviewed,
  markVehicleLineReviewed,
} from '@web/modules/vehicles/actions/vehicle-catalog.actions';
import CatalogMergeDialog, {
  type CatalogMergeTarget,
} from '@web/modules/vehicles/components/molecules/catalog-merge-dialog.component';
import CatalogNameDialog, {
  type CatalogNameTarget,
} from '@web/modules/vehicles/components/molecules/catalog-name-dialog.component';
import { VEHICLE_TYPES } from '@web/modules/vehicles/constants/vehicle-options.constants';
import { vehicleCatalogHref } from '@web/modules/vehicles/schemas/vehicle-catalog.schema';
import type {
  CatalogBrand,
  CatalogLine,
  CatalogReview,
  VehicleCatalogFilters,
} from '@web/modules/vehicles/types/vehicle-catalog.types';
import {
  catalogCounts,
  filterVehicleCatalog,
} from '@web/modules/vehicles/utils/vehicle-catalog-filter.utils';

type VehicleCatalogScreenProps = {
  filters: VehicleCatalogFilters;
  /** Every brand of the type, with their lines, in alphabetical order (CA-01). */
  brands: CatalogBrand[];
};

type Dialog =
  | { kind: 'name'; target: CatalogNameTarget }
  | { kind: 'merge'; target: CatalogMergeTarget }
  | null;

const SEARCH_DELAY_MS = 300;
const REVIEW_DOTS: Record<CatalogReview, string> = {
  pending: 'bg-warning',
  reviewed: 'bg-default-400',
};
const ACTIONS_TRIGGER =
  'relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-small text-default-500 outline-none hover:bg-default-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus';

/**
 * «Marcas y líneas» (spec 018, HU-01 to HU-06): the admin reviews the brands of each type and their
 * lines, how many vehicles use them and which ones someone added and are still to review (the cards
 * «Por revisar» / «Revisadas» and the search, in the address), and keeps the catalog clean: rename,
 * merge, move a line, register what is missing and mark reviewed what is well written.
 */
const VehicleCatalogScreen = ({ filters, brands }: VehicleCatalogScreenProps) => {
  const t = useTranslations('vehicles');
  const format = useFormatter();
  const [search, setSearch] = useState(filters.q);
  const lastSent = useRef(filters.q);
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const router = useRouter();
  const [, startMarking] = useTransition();

  // CA-29: a well written brand or line is marked reviewed right away (an action on its own: its
  // result is a floating notice, spec 013).
  const markReviewed = (kind: 'brand' | 'line', item: CatalogLine) =>
    startMarking(async () => {
      const result = await callAction(() =>
        kind === 'brand'
          ? markVehicleBrandReviewed({ id: item.id })
          : markVehicleLineReviewed({ id: item.id })
      );
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      notify(
        result.ok
          ? { tone: 'success', text: t('catalog.reviewed', { name: item.name }) }
          : { tone: 'danger', text: t(`catalog.errors.${result.error}`) }
      );
      router.refresh();
    });

  // The type, the card and the search live in the address (CA-01, project standard).
  const { navigate, latest, isPending } = useUrlFilters({
    filters,
    href: vehicleCatalogHref,
    onOutside: ({ q }) => {
      if (q === lastSent.current) return;
      lastSent.current = q;
      setSearch(q);
    },
  });

  // CA-04: the search waits until the person stops typing.
  useEffect(() => {
    const q = search.trim();
    if (q === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = q;
      navigate({ ...latest(), q });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only typing triggers a search
  }, [search]);

  const counts = catalogCounts(brands);
  const shown = filterVehicleCatalog(brands, filters);
  const isFiltering = filters.status !== null || filters.q !== '';
  const summaryText = [
    isFiltering
      ? t('catalog.filter.shown', { shown: shown.length, total: brands.length })
      : t('catalog.filter.total', { count: brands.length }),
    filters.status && t(`catalog.summary.${filters.status}`),
    filters.q && t('catalog.filter.search', { q: filters.q }),
  ]
    .filter(Boolean)
    .join(' · ');

  // A search that matched a line shows the lines, to see which one (CA-04).
  const isOpen = (id: string) => filters.q !== '' || opened.has(id);
  const toggle = (id: string) =>
    setOpened((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const origin = (item: CatalogLine) =>
    !item.reviewed && (
      <span className="rounded-full border border-default-300 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground">
        {t('catalog.pending', {
          date: format.dateTime(new Date(item.created_at), { dateStyle: 'medium' }),
        })}
      </span>
    );
  const pendingLines = (brand: CatalogBrand) => brand.lines.filter((line) => !line.reviewed).length;
  const count = (item: CatalogLine) => (
    <span className="text-sm whitespace-nowrap text-default-500 tabular-figures">
      {t('catalog.vehicles', { count: item.vehicles })}
    </span>
  );

  const brandActions = (brand: CatalogBrand) => (
    <Dropdown placement="bottom-end" classNames={{ trigger: 'aria-expanded:opacity-100' }}>
      <DropdownTrigger>
        <button
          type="button"
          aria-label={t('catalog.brandActions', { name: brand.name })}
          className={ACTIONS_TRIGGER}
        >
          <EllipsisVertical aria-hidden className="size-4" />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t('catalog.brandActions', { name: brand.name })}
        onAction={(key) => {
          if (key === 'markReviewed') return markReviewed('brand', brand);
          setDialog(
            key === 'rename'
              ? { kind: 'name', target: { kind: 'renameBrand', id: brand.id, name: brand.name } }
              : key === 'addLine'
                ? {
                    kind: 'name',
                    target: { kind: 'addLine', brandId: brand.id, brandName: brand.name },
                  }
                : { kind: 'merge', target: { kind: 'mergeBrand', brand } }
          );
        }}
      >
        {[
          <DropdownItem key="rename">{t('catalog.actions.rename')}</DropdownItem>,
          ...(brand.reviewed
            ? []
            : [
                <DropdownItem key="markReviewed">{t('catalog.actions.markReviewed')}</DropdownItem>,
              ]),
          <DropdownItem key="addLine">{t('catalog.actions.addLine')}</DropdownItem>,
          <DropdownItem key="mergeBrand">{t('catalog.actions.mergeBrand')}</DropdownItem>,
        ]}
      </DropdownMenu>
    </Dropdown>
  );

  const lineActions = (brand: CatalogBrand, line: CatalogLine) => (
    <Dropdown placement="bottom-end" classNames={{ trigger: 'aria-expanded:opacity-100' }}>
      <DropdownTrigger>
        <button
          type="button"
          aria-label={t('catalog.lineActions', { name: line.name })}
          className={ACTIONS_TRIGGER}
        >
          <EllipsisVertical aria-hidden className="size-4" />
        </button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t('catalog.lineActions', { name: line.name })}
        onAction={(key) => {
          if (key === 'markReviewed') return markReviewed('line', line);
          setDialog(
            key === 'rename'
              ? { kind: 'name', target: { kind: 'renameLine', id: line.id, name: line.name } }
              : { kind: 'merge', target: { kind: key as 'mergeLine' | 'moveLine', brand, line } }
          );
        }}
      >
        {[
          <DropdownItem key="rename">{t('catalog.actions.rename')}</DropdownItem>,
          ...(line.reviewed
            ? []
            : [
                <DropdownItem key="markReviewed">{t('catalog.actions.markReviewed')}</DropdownItem>,
              ]),
          <DropdownItem key="mergeLine">{t('catalog.actions.mergeLine')}</DropdownItem>,
          <DropdownItem key="moveLine">{t('catalog.actions.moveLine')}</DropdownItem>,
        ]}
      </DropdownMenu>
    </Dropdown>
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('catalog.title')}</h1>
          <p className="text-default-500">{t('catalog.description')}</p>
        </div>
        {/* HU-06, CA-26: a brand of the type that is missing. */}
        <Button
          color="primary"
          className="font-medium"
          startContent={<Plus aria-hidden className="size-4" />}
          onPress={() =>
            setDialog({ kind: 'name', target: { kind: 'addBrand', type: filters.type } })
          }
        >
          {t('catalog.addBrand')}
        </Button>
      </div>

      {/* CA-01: the type, as links (each has its address); the current one marked. */}
      <nav aria-label={t('catalog.typesLabel')}>
        <ul className="inline-flex gap-1 rounded-medium bg-default-100 p-1">
          {VEHICLE_TYPES.map((type) => {
            const isCurrent = type === filters.type;
            return (
              <li key={type}>
                <Link
                  href={vehicleCatalogHref({ ...filters, type })}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`inline-flex h-8 items-center rounded-small px-3 text-sm transition-colors ${
                    isCurrent
                      ? 'bg-content1 font-medium text-foreground shadow-small'
                      : 'text-default-600 hover:text-foreground'
                  }`}
                >
                  {t(`types.${type}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <SummaryFilterCards
        label={t('catalog.summary.filterLabel')}
        options={(['pending', 'reviewed'] as const).map((value) => ({
          value,
          label: t(`catalog.summary.${value}`),
          count: counts[value],
          dot: REVIEW_DOTS[value],
        }))}
        selected={filters.status}
        onSelect={(status) => navigate({ ...latest(), status })}
      />

      <div className="flex flex-col gap-3">
        <Input
          type="search"
          value={search}
          onValueChange={setSearch}
          aria-label={t('catalog.searchLabel')}
          placeholder={t('catalog.searchPlaceholder')}
          variant="bordered"
          isClearable
          onClear={() => setSearch('')}
          startContent={<Search aria-hidden className="size-4 shrink-0 text-default-400" />}
          className="max-w-md"
        />
        <FilterBar
          text={summaryText}
          showReset={isFiltering}
          onReset={() => {
            lastSent.current = '';
            setSearch('');
            navigate({ ...latest(), status: null, q: '' });
          }}
        />

        <div aria-busy={isPending} className={isPending ? 'opacity-60 transition-opacity' : ''}>
          {shown.length === 0 ? (
            <p className="rounded-large border border-dashed border-default-300 p-8 text-center text-sm text-default-500">
              {brands.length === 0 ? t('catalog.empty') : t('catalog.noMatch')}
            </p>
          ) : (
            <ul
              aria-label={t('catalog.listLabel')}
              className="flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small"
            >
              {shown.map((brand) => {
                const open = isOpen(brand.id);
                return (
                  <li key={brand.id}>
                    {/* The whole row opens the brand: its button stretches over it (after:inset-0); the
                        actions menu sits above it, with its own click. */}
                    <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-default-50 dark:hover:bg-default-100/50">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`lines-${brand.id}`}
                        onClick={() => toggle(brand.id)}
                        className="-mx-1 inline-flex min-w-0 items-center gap-1 rounded-small px-1 text-left font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <span className="sr-only">{t('catalog.showLines')} </span>
                        {brand.name}
                        <ChevronDown
                          aria-hidden
                          className={`size-4 shrink-0 text-default-400 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {origin(brand)}
                      {brand.reviewed && pendingLines(brand) > 0 && (
                        // CA-03: why a reviewed brand is under «Por revisar»: a line someone typed.
                        <span className="rounded-full border border-default-300 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-foreground">
                          {t('catalog.pendingLines', { count: pendingLines(brand) })}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-2">
                        {count(brand)}
                        {brandActions(brand)}
                      </span>
                    </div>
                    {open && (
                      <div
                        id={`lines-${brand.id}`}
                        className="border-t border-divider bg-default-50/60 px-4 py-2 pl-8"
                      >
                        {brand.lines.length === 0 ? (
                          <p className="py-1 text-sm text-default-500">{t('catalog.noLines')}</p>
                        ) : (
                          <ul
                            aria-label={t('catalog.linesOf', { name: brand.name })}
                            className="flex flex-col"
                          >
                            {brand.lines.map((line) => (
                              <li
                                key={line.id}
                                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
                              >
                                <span className="min-w-0 text-sm">{line.name}</span>
                                {origin(line)}
                                <span className="ml-auto flex items-center gap-2">
                                  {count(line)}
                                  {lineActions(brand, line)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {dialog?.kind === 'name' && (
        <CatalogNameDialog target={dialog.target} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'merge' && (
        <CatalogMergeDialog
          target={dialog.target}
          brands={brands}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  );
};

export default VehicleCatalogScreen;
