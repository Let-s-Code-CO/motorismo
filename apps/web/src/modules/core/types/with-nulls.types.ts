/**
 * The generator marks every column a function returns as not null; `WithNulls` says which of them
 * may be null (no line, no plate…), so the code handles them (specs 014 and 015).
 */
export type WithNulls<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };
