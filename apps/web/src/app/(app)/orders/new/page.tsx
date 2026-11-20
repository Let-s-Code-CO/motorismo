import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import NewOrderScreen from '@web/modules/work-orders/components/organisms/new-order-screen.component';

/** «Nueva orden» (spec 008, HU-01): staff only. */
const NewOrderPage = async () => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  return <NewOrderScreen />;
};

export default NewOrderPage;
