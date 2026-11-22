'use client';

import { useId } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@heroui/react';
import { CalendarClock, CalendarPlus, History } from 'lucide-react';

import ArriveBy from '@web/modules/customer-area/components/atoms/arrive-by.component';
import ShopOrderCard from '@web/modules/customer-area/components/molecules/shop-order-card.component';
import useSlotLabel from '@web/modules/customer-area/hooks/slot-label.hook';
import type {
  MyReservation,
  ShopOrder,
} from '@web/modules/customer-area/types/customer-area.types';

type CustomerHomeProps = {
  name: string;
  orders: ShopOrder[];
  /** Their nearest pending reservation, if any. */
  next: MyReservation | null;
};

const CARD = 'rounded-large border border-divider bg-content1 p-5 shadow-small';

/**
 * The customer's «Inicio» (spec 014, RF-01): their vehicles in the shop, each apart (CA-03) or that
 * there is none (CA-04); their next reservation with until when they may arrive; and ways to book, to
 * their reservations and to their history.
 */
const CustomerHome = ({ name, orders, next }: CustomerHomeProps) => {
  const t = useTranslations('customerArea');
  const slotLabel = useSlotLabel();
  const shopId = useId();
  const nextId = useId();
  const firstName = name.split(' ')[0] ?? name;

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('home.title', { name: firstName })}
        </h1>
        <p className="text-default-500">{t('home.description')}</p>
      </div>

      <section aria-labelledby={shopId} className="flex flex-col gap-3">
        <h2 id={shopId} className="font-semibold tracking-tight">
          {t('home.inShop')}
        </h2>
        {orders.length ? (
          orders.map((order) => <ShopOrderCard key={order.id} order={order} />)
        ) : (
          <p className={`${CARD} text-sm text-default-500`}>{t('home.noneInShop')}</p>
        )}
      </section>

      <section aria-labelledby={nextId} className={`${CARD} flex flex-col gap-3`}>
        <h2 id={nextId} className="font-semibold tracking-tight">
          {t('home.nextReservation')}
        </h2>
        {next ? (
          <div className="flex flex-col gap-0.5">
            <p className="font-medium first-letter:uppercase">
              {slotLabel(next.slot_start, next.slot_end)}
            </p>
            {next.grace_until && (
              <ArriveBy graceUntil={next.grace_until} className="text-sm text-default-500" />
            )}
          </div>
        ) : (
          <p className="text-sm text-default-500">{t('home.noReservation')}</p>
        )}
        <Button
          as={Link}
          href="/my/reservations"
          variant="bordered"
          className="w-max"
          startContent={<CalendarClock aria-hidden className="size-4" />}
        >
          {t('home.reservations')}
        </Button>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          as={Link}
          href="/my/reservations/new"
          color="primary"
          className="font-medium"
          startContent={<CalendarPlus aria-hidden className="size-4" />}
        >
          {t('home.book')}
        </Button>
        <Button
          as={Link}
          href="/my/history"
          variant="bordered"
          startContent={<History aria-hidden className="size-4" />}
        >
          {t('home.history')}
        </Button>
      </div>
    </section>
  );
};

export default CustomerHome;
