import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getPlateCities } from '@web/modules/vehicles/api/plate-cities.server';
import PlateCitiesScreen from '@web/modules/vehicles/components/organisms/plate-cities-screen.component';

/**
 * «Ciudades de placa», a tab of «Marcas y líneas» (spec 023, HU-03): admin only (CA-11). A customer or
 * an operator are told they have no permission; set_plate_legend refuses them too.
 */
const PlateCitiesPage = async () => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  return <PlateCitiesScreen cities={await getPlateCities()} />;
};

export default PlateCitiesPage;
