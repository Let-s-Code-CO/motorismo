import type { Tables } from '@motorismo/supabase/types';

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
