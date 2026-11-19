/** Result of a Server Action. Errors are message keys, translated by the component. */
export type ActionResult<TError extends string = string> =
  { ok: true } | { ok: false; error: TError; fieldErrors?: Partial<Record<string, string[]>> };
