/**
 * The default share of each employee of a line (spec 008, CA-06, RN-03): equal whole percentages
 * adding up to 100, what does not divide evenly going to the first ones (3 → 34/33/33).
 */
export const splitShares = (count: number): number[] => {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
};
