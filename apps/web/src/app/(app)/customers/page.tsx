import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { countCustomersByStatus, listCustomers } from '@web/modules/customers/api/customers.server';
import CustomersScreen from '@web/modules/customers/components/organisms/customers-screen.component';
import { parseCustomerFilters } from '@web/modules/customers/utils/customers-filter.utils';

type CustomersPageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};

/** Staff only (spec 004, RF-04; customers get "no permission", CA-09). Data protected by RLS. */
const CustomersPage = async ({ searchParams }: CustomersPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const filters = parseCustomerFilters(await searchParams);
  const [{ rows, total }, counts] = await Promise.all([
    listCustomers(filters),
    countCustomersByStatus(),
  ]);

  return <CustomersScreen filters={filters} rows={rows} matching={total} counts={counts} />;
};

export default CustomersPage;
