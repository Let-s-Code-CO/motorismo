import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { listServices } from '@web/modules/services/api/services.server';
import ServicesScreen from '@web/modules/services/components/organisms/services-screen.component';

/**
 * «Servicios» (spec 007): staff only (a customer gets "no permission", CA-18). An admin manages
 * the catalog, an operator reads the active services (CA-15); RLS decides what each one gets.
 */
const ServicesPage = async () => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const services = await listServices();

  return <ServicesScreen services={services} isAdmin={staff.role === 'admin'} />;
};

export default ServicesPage;
