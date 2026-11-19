import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getCustomer } from '@web/modules/customers/api/customers.server';
import CustomerDetail from '@web/modules/customers/components/organisms/customer-detail.component';

type CustomerPageProps = { params: Promise<{ id: string }> };

/** A customer's record (spec 004, CA-18). Staff only; data protected by RLS. */
const CustomerPage = async ({ params }: CustomerPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const t = await getTranslations('customers.detail');

  return (
    <section className="flex flex-col gap-6">
      <Link
        href="/customers"
        className="inline-flex w-max items-center gap-1.5 rounded-medium text-sm font-medium text-default-600 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('back')}
      </Link>
      <CustomerDetail customer={customer} />
    </section>
  );
};

export default CustomerPage;
