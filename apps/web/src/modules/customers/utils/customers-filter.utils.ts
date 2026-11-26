import { Constants } from '@motorismo/supabase/types';

import type { CustomerStatus } from '@web/modules/auth/types/auth.types';
import { parseStatusParam } from '@web/modules/core/utils/status-filter.utils';

/** RF-05: the customer list is paginated by 20. */
export const CUSTOMERS_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;

/** A customer status, or "active": with or without account, not disabled (CA-17). */
export type CustomerStatusFilter = CustomerStatus | 'active';

const STATUS_FILTERS: readonly CustomerStatusFilter[] = [
  'active',
  ...Constants.public.Enums.customer_status,
];

export type CustomerFilters = { q: string; status: CustomerStatusFilter | null; page: number };

type RawParams = { q?: string | null; status?: string | null; page?: string | null };

/** `?q=&status=&page=` → the list state; anything invalid falls back to its default. */
export const parseCustomerFilters = ({ q, status, page }: RawParams): CustomerFilters => ({
  q: (q ?? '').trim().slice(0, MAX_SEARCH_LENGTH),
  status: parseStatusParam(status, STATUS_FILTERS),
  page: page && /^\d+$/.test(page) && Number(page) >= 1 ? Number(page) : 1,
});

/**
 * Lowercase and without accents, like the database's search_text (CA-16): "José" → "jose",
 * "Ñáñez" → "nanez". Inner spaces collapse to one; a plate loses its separators (spec 005).
 */
export const normalizeSearch = (raw: string): string => {
  const text = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  // A plate (three letters, then digits: "UIH-03", "uih 03") is kept without separators, as the
  // database stores it (spec 005, CA-17).
  return LOOKS_LIKE_PLATE.test(text) ? text.replace(/[\s-]/g, '') : text;
};

const LOOKS_LIKE_PLATE = /^[a-z]{3}[\s-]?\d[\da-z\s-]*$/;

/**
 * The active plate of a customer that a search matched, to show it in the row (spec 005, CA-19);
 * null when the search matched something else. `plates` is the customer's `vehicle_plates`.
 */
export const matchingPlate = (plates: string, query: string): string | null => {
  const key = query.replace(/[\s.-]/g, '').toUpperCase();
  if (key.length < 3) return null;
  return plates.split(' ').find((plate) => plate !== '' && plate.includes(key)) ?? null;
};

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

/**
 * A customer's record, opened from the list in some state (CA-33): it carries that state in `?list=`
 * so «Volver a clientes» returns to the same filter, search and page.
 */
export const customerRecordHref = (id: string, filters: CustomerFilters): string => {
  const query = customersQueryString(filters).slice(1);
  return query ? `/customers/${id}?list=${encodeURIComponent(query)}` : `/customers/${id}`;
};

/**
 * The list a record goes back to (CA-33): the state it carries, read again as filters, so nothing
 * else in it survives (it only ever leads to the list); without it, the whole list.
 */
export const customersListHref = (list: string | null | undefined): string => {
  const params = new URLSearchParams(list ?? '');
  const filters = parseCustomerFilters({
    q: params.get('q'),
    status: params.get('status'),
    page: params.get('page'),
  });
  return `/customers${customersQueryString(filters)}`;
};

/** Customers who can be served: with or without account, not disabled (CA-17). */
export const activeCount = (counts: Record<CustomerStatus, number>): number =>
  counts.registered + counts.walk_in;
