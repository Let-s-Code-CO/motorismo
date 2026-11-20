/**
 * Rule of the whole interface (spec 008, RN-10): a list with only one possible choice comes
 * already chosen — the only vehicle of a customer, the only active employee… — so nobody has to
 * open a list to pick the one thing in it. Returns that item, or nothing when there is a choice.
 */
export const singleOption = <T>(items: readonly T[]): T | undefined =>
  items.length === 1 ? items[0] : undefined;
