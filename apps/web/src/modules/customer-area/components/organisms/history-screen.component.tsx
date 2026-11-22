'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@heroui/react';
import { ArrowLeft, ChevronDown } from 'lucide-react';

import HistoryOrderCard from '@web/modules/customer-area/components/molecules/history-order-card.component';
import type { HistoryOrder } from '@web/modules/customer-area/types/customer-area.types';

type HistoryScreenProps = {
  /** A page of closed orders, newest first. */
  orders: HistoryOrder[];
  /** The date the page starts before (`?before=`), or null for the newest. */
  before: string | null;
  /** Whether there may be older ones (a full page). */
  hasMore: boolean;
};

/**
 * The customer's «Historial» (spec 014, HU-02): their closed orders, newest first (CA-07), a page at
 * a time through the address (CA-11); with none, it says so (CA-10).
 */
const HistoryScreen = ({ orders, before, hasMore }: HistoryScreenProps) => {
  const t = useTranslations('customerArea.history');
  const last = orders.at(-1);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-default-500">{t('description')}</p>
      </div>

      {orders.length ? (
        <div className="flex flex-col gap-4">
          {orders.map((order) => (
            <HistoryOrderCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <p className="rounded-large border border-dashed border-default-300 p-5 text-center text-sm text-default-500">
          {t('empty')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {before && (
          <Button
            as={Link}
            href="/my/history"
            variant="light"
            startContent={<ArrowLeft aria-hidden className="size-4" />}
          >
            {t('newest')}
          </Button>
        )}
        {hasMore && last && (
          <Button
            as={Link}
            href={`/my/history?before=${encodeURIComponent(last.closed_at)}`}
            variant="bordered"
            startContent={<ChevronDown aria-hidden className="size-4" />}
          >
            {t('older')}
          </Button>
        )}
      </div>
    </section>
  );
};

export default HistoryScreen;
