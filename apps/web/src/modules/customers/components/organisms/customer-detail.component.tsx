'use client';

import type { ReactNode } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@heroui/react';
import { CalendarPlus } from 'lucide-react';

import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';
import type { CustomerRecord } from '@web/modules/customers/api/customers.server';
import CustomerStatusChip from '@web/modules/customers/components/atoms/customer-status-chip.component';
import CustomerContactCard from '@web/modules/customers/components/organisms/customer-contact-card.component';

type CustomerDetailProps = {
  customer: CustomerRecord;
  /** Vehicles, access actions… rendered under the record (spec 004 HU-07, spec 005). */
  children?: ReactNode;
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="text-xs font-medium tracking-wide text-default-500 uppercase">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

/**
 * A customer's record for staff (spec 004, CA-18): name, email, phone, status, origin, date,
 * when they authorised the processing of their data and, for the counter, who registered them.
 * The contact card carries the "Editar datos" icon button (CA-27).
 */
const CustomerDetail = ({ customer, children }: CustomerDetailProps) => {
  const t = useTranslations('customers');
  const format = useFormatter();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'long' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar
          name={customer.full_name}
          src={customer.avatar_url}
          size="lg"
          className="bg-primary text-primary-foreground"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {customer.full_name}
          </h1>
          <CustomerStatusChip status={customer.status} />
        </div>
        {/* Spec 012, CA-40: book this customer without looking for them again; never if disabled. */}
        {customer.disabled_at === null && (
          <Button
            as={Link}
            href={`/agenda/new?customer=${customer.id}`}
            variant="bordered"
            className="ml-auto"
            startContent={<CalendarPlus aria-hidden className="size-4" />}
          >
            {t('detail.book')}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CustomerContactCard customer={customer} />
        <section className="rounded-large border border-divider bg-content1 p-5 shadow-small">
          <h2 className="mb-4 text-sm font-semibold">{t('detail.record')}</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label={t('detail.origin')}>{t(`origin.${customer.origin}`)}</Field>
            <Field label={t('detail.since')}>{date(customer.created_at)}</Field>
            <Field label={t('detail.consent')}>{date(customer.consent_at)}</Field>
            {customer.registrar_name && (
              <Field label={t('detail.registeredBy')}>{customer.registrar_name}</Field>
            )}
          </dl>
        </section>
      </div>

      {children}
    </div>
  );
};

export default CustomerDetail;
