import { redirect } from 'next/navigation';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import StaffHome from '@web/modules/auth/components/organisms/staff-home.component';
import { dataRequestsSummary } from '@web/modules/data-rights/api/data-rights.server';
import { openOrdersCount } from '@web/modules/work-orders/api/work-orders.server';

/**
 * Home of the staff: who they are, their role and where to go (spec 002, CA-01), as an app menu
 * with what is in the car wash (spec 009, HU-02) and, for the admin, the data requests waiting
 * (spec 017, CA-10). Customers have their own home.
 */
const HomePage = async () => {
  const user = await getStaffForPage();
  // The proxy already sends customers to their home (spec 014); this is the second check.
  if (!user) redirect('/my');
  const [openOrders, dataRequests] = await Promise.all([
    openOrdersCount(),
    user.role === 'admin' ? dataRequestsSummary() : undefined,
  ]);

  return (
    <StaffHome
      name={user.full_name}
      role={user.role}
      openOrders={openOrders}
      dataRequests={dataRequests}
    />
  );
};

export default HomePage;
