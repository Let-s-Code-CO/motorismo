import { Constants } from '@motorismo/supabase/types';

import type { CustomerStatus } from '@web/modules/auth/types/auth.types';
import { parseStatusParam } from '@web/modules/core/utils/status-filter.utils';

/** RF-05: the customer list is paginated by 20. */
export const CUSTOMERS_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;

export type CustomerFilters = { q: string; status: CustomerStatus | null; page: number };

type RawParams = { q?: string | null; status?: string | null; page?: string | null };

/** `?q=&status=&page=` → the list state; anything invalid falls back to its default. */
export const parseCustomerFilters = ({ q, status, page }: RawParams): CustomerFilters => ({
  q: (q ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
  status: parseStatusParam(status, Constants.public.Enums.customer_status),
  page: page && /^\d+$/.test(page) && Number(page) >= 1 ? Number(page) : 1,
});

/**
 * Lowercase and without accents, like the database's search_text (CA-16): "José" → "jose",
 * "Ñáñez" → "nanez". Inner spaces collapse to one.
 */
export const normalizeSearch = (raw: string): string =>
  raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** ILIKE pattern for "contains", with the user's % and _ escaped (searched literally). */
export const toLikePattern = (raw: string): string =>
  `%${normalizeSearch(raw).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** Inclusive 0-based row range of a page (for `.range(from, to)`). */
export const pageRange = (page: number): [number, number] => [
  (page - 1) * CUSTOMERS_PAGE_SIZE,
  page * CUSTOMERS_PAGE_SIZE - 1,
];

export const pageCount = (total: number): number =>
  Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE));

/** The URL query for a list state, keeping only what differs from the defaults. */
export const customersQueryString = ({ q, status, page }: CustomerFilters): string => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (status) params.set('status', status);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
};
