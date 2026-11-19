/**
 * The project standard "summary cards as filters" (spec 003 CA-09, spec 004 CA-17): the chosen
 * status lives in the URL (?status=…); anything that is not an allowed value means "no filter".
 */
export const parseStatusParam = <T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[]
): T | null => allowed.find((value) => value === raw) ?? null;

/** Client-side filtering for small lists (e.g. users); large lists filter in the database. */
export const filterByStatus = <R extends { status: string }>(
  rows: R[],
  status: R['status'] | null
): R[] => (status ? rows.filter((row) => row.status === status) : rows);
