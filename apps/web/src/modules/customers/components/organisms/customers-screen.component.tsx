'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Pagination,
  useDisclosure,
} from '@heroui/react';
import { Search, UserPlus } from 'lucide-react';

import type { CustomerStatus } from '@web/modules/auth/types/auth.types';
import FilterBar from '@web/modules/core/components/filter-bar.component';
import SummaryFilterCards from '@web/modules/core/components/summary-filter-cards.component';
import type { CustomerListRow } from '@web/modules/customers/api/customers.server';
import CustomerForm from '@web/modules/customers/components/organisms/customer-form.component';
import CustomersTable from '@web/modules/customers/components/organisms/customers-table.component';
import {
  type CustomerFilters,
  type CustomerStatusFilter,
  activeCount,
  customersQueryString,
  pageCount,
} from '@web/modules/customers/utils/customers-filter.utils';

/** Summary cards = filters (project standard): order and status dot of each card. */
const SUMMARY: { status: CustomerStatusFilter; dot: string }[] = [
  { status: 'active', dot: 'bg-foreground' },
  { status: 'registered', dot: 'bg-success' },
  { status: 'walk_in', dot: 'bg-warning' },
  { status: 'disabled', dot: 'bg-default-400' },
];

const SEARCH_DELAY_MS = 300;

type CustomersScreenProps = {
  filters: CustomerFilters;
  rows: CustomerListRow[];
  /** Customers matching the search and filter (all pages). */
  matching: number;
  counts: Record<CustomerStatus, number>;
};

/**
 * Staff list of customers (spec 004, HU-04). Its whole state — search, status, page — lives in the
 * URL, so it survives a reload and "back" (CA-17); the server renders each state.
 */
const CustomersScreen = ({ filters, rows, matching, counts }: CustomersScreenProps) => {
  const t = useTranslations('customers');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);
  const [notice, setNotice] = useState<string>();
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const lastSent = useRef(filters.q);

  const navigate = (next: CustomerFilters) =>
    startTransition(() =>
      router.replace(`${pathname}${customersQueryString(next)}`, { scroll: false })
    );

  // The URL changed from outside (back button, "Ver todos"): show its search in the box.
  useEffect(() => {
    if (filters.q !== lastSent.current) {
      lastSent.current = filters.q;
      setSearch(filters.q);
    }
  }, [filters.q]);

  // The search waits until the person stops typing; a new search starts at page 1 (CA-16).
  useEffect(() => {
    const q = search.trim();
    if (q === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = q;
      navigate({ ...filters, q, page: 1 });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only typing triggers a search
  }, [search]);

  const total = activeCount(counts) + counts.disabled;
  const countOf = (status: CustomerStatusFilter) =>
    status === 'active' ? activeCount(counts) : counts[status];
  const isFiltering = filters.status !== null || filters.q !== '';
  const summaryText = [
    isFiltering
      ? t('filter.shown', { shown: matching, total })
      : t('filter.total', { count: total }),
    filters.status && t(`summary.${filters.status}`),
    filters.q && t('filter.search', { q: filters.q }),
  ]
    .filter(Boolean)
    .join(' · ');

  const emptyLabel = filters.q
    ? t('table.noMatch')
    : filters.status
      ? t('table.emptyFiltered')
      : t('table.empty');

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-default-500">{t('description')}</p>
        </div>
        {/* HU-06: staff register a customer who arrives without an account. */}
        <Button
          color="primary"
          className="font-medium"
          startContent={<UserPlus aria-hidden className="size-4" />}
          onPress={() => {
            setNotice(undefined);
            onOpen();
          }}
        >
          {t('newButton')}
        </Button>
      </div>

      <SummaryFilterCards
        label={t('summary.filterLabel')}
        options={SUMMARY.map(({ status, dot }) => ({
          value: status,
          dot,
          label: t(`summary.${status}`),
          count: countOf(status),
        }))}
        selected={filters.status}
        onSelect={(status) => navigate({ ...filters, status, page: 1 })}
      />

      {notice && <Alert color="success" variant="faded" title={notice} />}

      <div className="flex flex-col gap-3">
        <Input
          type="search"
          value={search}
          onValueChange={setSearch}
          aria-label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
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
            navigate({ q: '', status: null, page: 1 });
          }}
        />
        <div aria-busy={isPending} className={isPending ? 'opacity-60 transition-opacity' : ''}>
          <CustomersTable customers={rows} query={filters.q} emptyLabel={emptyLabel} />
        </div>
        {pageCount(matching) > 1 && (
          <nav aria-label={t('pagination.label')} className="flex justify-center pt-2">
            <Pagination
              page={filters.page}
              total={pageCount(matching)}
              onChange={(page) => navigate({ ...filters, page })}
              showControls
              variant="light"
            />
          </nav>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" backdrop="blur">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-lg font-semibold tracking-tight">{t('form.title')}</span>
            <span className="text-sm font-normal text-default-500">{t('form.description')}</span>
          </ModalHeader>
          <ModalBody className="pb-6">
            <CustomerForm
              mode="create"
              onCancel={onClose}
              onSaved={() => {
                onClose();
                setNotice(t('created'));
                router.refresh();
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </section>
  );
};

export default CustomersScreen;
