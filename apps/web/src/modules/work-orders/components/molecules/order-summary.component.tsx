'use client';

import type { ReactNode } from 'react';

import { useTranslations } from 'next-intl';

import { formatPesos } from '@web/modules/core/utils/money.utils';

type OrderSummaryProps = {
  subtotal: number;
  total: number;
  /** The discount field (editable) or its value (read only). */
  discount: ReactNode;
  /** The estimate line (HU-06), when there is one. */
  estimate?: ReactNode;
};

/**
 * Subtotal, discount and total of an order, always in sight while it is put together (spec 008,
 * CA-04, CA-25). Announced politely as it changes.
 */
const OrderSummary = ({ subtotal, total, discount, estimate }: OrderSummaryProps) => {
  const t = useTranslations('orders.summary');

  return (
    <section
      aria-label={t('label')}
      className="flex flex-col gap-2 rounded-large border border-divider bg-content1 p-4 shadow-small"
    >
      <dl className="flex flex-col gap-1.5 text-sm" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-default-500">{t('subtotal')}</dt>
          <dd className="tabular-nums">{formatPesos(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">{discount}</div>
        <div className="flex items-center justify-between gap-4 border-t border-divider pt-2 text-base font-semibold">
          <dt>{t('total')}</dt>
          <dd className="tabular-nums">{formatPesos(total)}</dd>
        </div>
      </dl>
      {estimate}
    </section>
  );
};

export default OrderSummary;
