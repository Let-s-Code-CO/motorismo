import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { listDataRequests } from '@web/modules/data-rights/api/data-rights.server';
import DataRequestsScreen from '@web/modules/data-rights/components/organisms/data-requests-screen.component';

/**
 * «Solicitudes de datos» (spec 017, CA-09): admin only (RN-01). A customer or an operator are told
 * they have no permission (CA-15); RLS gives them nothing either.
 */
const DataRequestsPage = async () => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  return <DataRequestsScreen requests={await listDataRequests()} />;
};

export default DataRequestsPage;
