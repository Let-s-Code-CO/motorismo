import { Constants } from '@motorismo/supabase/types';

/** Payment methods (spec 008, RN-09), as the database knows them. */
export const PAYMENT_METHODS = Constants.public.Enums.payment_method;

/** RN-02: the highest price of a line. */
export const MAX_LINE_PRICE = 10_000_000;

/** RN-11: the range of an estimated time, in minutes. */
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 1440;

/** Closed orders shown per page in «Órdenes» (CA-19). */
export const CLOSED_PAGE_SIZE = 20;
