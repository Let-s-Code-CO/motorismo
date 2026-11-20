/** How sure an estimate is: every line has a time, only some (a minimum), or none. */
export type EstimateKind = 'complete' | 'minimum' | 'none';

/**
 * How long an order should take and when the vehicle should be ready (spec 008, HU-06): the sum of
 * the lines' times, one service after another (RN-11), from when it was received (CA-29). With lines
 * not estimated the sum is only a minimum and they are named (CA-30); with none, there is no
 * estimate.
 */
export const orderEstimate = (
  lines: readonly { name: string; estimated_minutes: number | null }[],
  receivedAt: Date
) => {
  const missing = lines.filter((line) => line.estimated_minutes == null).map((line) => line.name);
  const minutes = lines.reduce((sum, line) => sum + (line.estimated_minutes ?? 0), 0);
  const kind: EstimateKind = minutes === 0 ? 'none' : missing.length ? 'minimum' : 'complete';
  return {
    kind,
    minutes,
    missing,
    readyAt: kind === 'none' ? null : new Date(receivedAt.getTime() + minutes * 60_000),
  };
};
