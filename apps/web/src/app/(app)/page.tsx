import { redirect } from 'next/navigation';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import StaffHome from '@web/modules/auth/components/organisms/staff-home.component';
import { openOrdersCount } from '@web/modules/work-orders/api/work-orders.server';

/**
 * Home of the staff: who they are, their role and where to go (spec 002, CA-01), as an app menu
 * with what is in the car wash (spec 009, HU-02). Customers have «Mi perfil».
 */
const HomePage = async () => {
  const user = await getStaffForPage();
  // The proxy already sends customers to their profile (spec 004, CA-12); this is the second check.
  if (!user) redirect('/profile');
  const openOrders = await openOrdersCount();

  return <StaffHome name={user.full_name} role={user.role} openOrders={openOrders} />;
};

export default HomePage;
