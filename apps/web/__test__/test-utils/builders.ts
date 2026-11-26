import type { Tables } from '@motorismo/supabase/types';

import type { VehicleView } from '@web/modules/vehicles/api/vehicles.server';

export type ProfileRow = Pick<
  Tables<'profiles'>,
  'id' | 'full_name' | 'email' | 'role' | 'status' | 'avatar_url'
>;

let sequence = 0;

/** A typical active operator; override only the fields a test cares about. */
export const buildProfile = (overrides: Partial<ProfileRow> = {}): ProfileRow => {
  sequence += 1;
  return {
    id: `00000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    full_name: `Usuario ${sequence}`,
    email: `usuario${sequence}@motorismo.test`,
    role: 'operator',
    status: 'active',
    avatar_url: null,
    ...overrides,
  };
};

export type CustomerRow = Pick<
  Tables<'customers'>,
  'id' | 'user_id' | 'full_name' | 'email' | 'phone' | 'avatar_url' | 'disabled_at' | 'created_at'
>;

/** A typical customer with an account (spec 004); override only the fields a test cares about. */
export const buildCustomer = (overrides: Partial<CustomerRow> = {}): CustomerRow => {
  sequence += 1;
  return {
    id: `10000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    user_id: `20000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    full_name: `Cliente ${sequence}`,
    email: `cliente${sequence}@correo.test`,
    phone: '3001234567',
    avatar_url: null,
    disabled_at: null,
    created_at: '2026-11-01T15:00:00.000Z',
    ...overrides,
  };
};

/** A typical active motorcycle (Suzuki GSX-R600, 600 cc, black, UIH03D); override what matters. */
export const buildVehicle = (overrides: Partial<VehicleView> = {}): VehicleView => {
  sequence += 1;
  return {
    id: `30000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    vehicle_type: 'motorcycle',
    vehicle_class: null,
    displacement_cc: 600,
    color: 'black',
    plate: 'UIH03D',
    motorcycle_category: null,
    retired_at: null,
    created_at: '2026-11-01T15:00:00.000Z',
    brand: { name: 'Suzuki' },
    line: { name: 'GSX-R600', motorcycle_category: null },
    plate_city_code: null,
    plate_city: null,
    ...overrides,
  };
};
