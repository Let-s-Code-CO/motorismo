import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getCustomer } from '@web/modules/customers/api/customers.server';
import CustomerDetail from '@web/modules/customers/components/organisms/customer-detail.component';
import CustomerManage from '@web/modules/customers/components/organisms/customer-manage.component';
import RegisterDataRequestDialog from '@web/modules/data-rights/components/organisms/register-data-request-dialog.component';
import { listCustomerVehicles } from '@web/modules/vehicles/api/vehicles.server';
import VehiclesSection from '@web/modules/vehicles/components/organisms/vehicles-section.component';
import { listCustomerOrders } from '@web/modules/work-orders/api/work-orders.server';
import CustomerHistory from '@web/modules/work-orders/components/organisms/customer-history.component';

type CustomerPageProps = { params: Promise<{ id: string }> };

/**
 * A customer's record (spec 004, CA-18) with their vehicles (spec 005, HU-01) and their work
 * orders (spec 008, CA-16), where staff edit it
 * (CA-27) and staff disable or reactivate it (RN-09, CA-29 to CA-31). Staff only; data protected by RLS and the database guard.
 */
const CustomerPage = async ({ params }: CustomerPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const customer = await getCustomer(id);
  if (!customer) notFound();
  const [vehicles, orders] = await Promise.all([
    listCustomerVehicles(customer.id),
    listCustomerOrders(customer.id),
  ]);

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
      <CustomerDetail customer={customer}>
        <VehiclesSection
          customerId={customer.id}
          audience="staff"
          vehicles={vehicles.active}
          retired={vehicles.retired}
          readOnly={customer.disabled_at !== null}
        />
        <div className="rounded-large border border-divider bg-content1 p-5 shadow-small">
          <CustomerHistory orders={orders} variant="full" />
        </div>
        {/* Spec 017, RN-09: an erased customer is final: neither disabled nor reactivated again. */}
        {!customer.erased_at && <CustomerManage customer={customer} />}
        {/* Spec 017, CA-16: the admin registers a data request that came by the counter or Instagram. */}
        {staff.role === 'admin' && !customer.erased_at && (
          <RegisterDataRequestDialog customerId={customer.id} />
        )}
      </CustomerDetail>
    </section>
  );
};

export default CustomerPage;
