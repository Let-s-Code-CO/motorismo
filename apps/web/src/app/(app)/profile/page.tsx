import { getTranslations } from 'next-intl/server';

import { requireCustomer } from '@web/modules/auth/api/auth.server';
import RoleChip from '@web/modules/auth/components/atoms/role-chip.component';
import UserAvatar from '@web/modules/auth/components/atoms/user-avatar.component';
import MyProfileForm from '@web/modules/customers/components/organisms/my-profile-form.component';
import { listCustomerVehicles } from '@web/modules/vehicles/api/vehicles.server';
import VehiclesSection from '@web/modules/vehicles/components/organisms/vehicles-section.component';

/**
 * "Mi perfil" (spec 004, HU-03): the customer's home, with "Mis vehículos" (spec 005, HU-06).
 * Staff are sent to their own home page.
 */
const ProfilePage = async () => {
  const customer = await requireCustomer();
  const t = await getTranslations('customers.profile');
  const vehicles = await listCustomerVehicles(customer.id);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-default-500">{t('description')}</p>
      </div>
      <div className="flex flex-col gap-6 rounded-large border border-divider bg-content1 p-6 shadow-small">
        <div className="flex items-center gap-4">
          <UserAvatar
            name={customer.full_name}
            src={customer.avatar_url}
            size="lg"
            className="bg-primary text-primary-foreground"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-lg font-semibold tracking-tight">
              {customer.full_name}
            </span>
            <RoleChip audience="customer" />
          </div>
        </div>
        <MyProfileForm customer={customer} />
      </div>
      <VehiclesSection
        customerId={customer.id}
        audience="customer"
        vehicles={vehicles.active}
        retired={[]}
        readOnly={false}
      />
    </section>
  );
};

export default ProfilePage;
