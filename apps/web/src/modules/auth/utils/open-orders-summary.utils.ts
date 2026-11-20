export type OpenOrdersCount = { inProgress: number; queued: number };

export type OpenOrdersSummary = { kind: 'none' } | ({ kind: 'some' } & OpenOrdersCount);

/**
 * What the «Órdenes» tile says about the car wash (spec 009, CA-07): nothing open, or how many are
 * in progress and how many queued (spec 008, RN-12), even when one of them is 0.
 */
export const openOrdersSummary = ({ inProgress, queued }: OpenOrdersCount): OpenOrdersSummary =>
  inProgress === 0 && queued === 0 ? { kind: 'none' } : { kind: 'some', inProgress, queued };
