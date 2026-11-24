import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getVehicleCatalog } from '@web/modules/vehicles/api/vehicle-catalog.server';
import VehicleCatalogScreen from '@web/modules/vehicles/components/organisms/vehicle-catalog-screen.component';
import { parseVehicleCatalogFilters } from '@web/modules/vehicles/schemas/vehicle-catalog.schema';

type VehicleCatalogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * «Marcas y líneas» (spec 018): admin only (RN-01). A customer or an operator are told they have no
 * permission (CA-05); the database functions refuse them too. The type, the card and the search come
 * from the address (CA-01).
 */
const VehicleCatalogPage = async ({ searchParams }: VehicleCatalogPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const raw = await searchParams;
  const filters = parseVehicleCatalogFilters({
    type: first(raw.type),
    status: first(raw.status),
    q: first(raw.q),
  });

  return <VehicleCatalogScreen filters={filters} brands={await getVehicleCatalog(filters.type)} />;
};

export default VehicleCatalogPage;
