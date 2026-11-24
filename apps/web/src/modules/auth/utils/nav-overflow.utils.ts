/**
 * How many entries of the desktop bar fit in line (spec 018, HU-05), given their widths, the room
 * of the bar, the width of «Más ▾» and the gap between entries. All of them if they fit without
 * «Más» (CA-22); otherwise as many as fit next to «Más», leaving from the end (CA-25); never fewer
 * than one, so «Inicio» always stays.
 */
export const visibleCount = (
  widths: number[],
  available: number,
  moreWidth: number,
  gap: number
): number => {
  const span = (count: number) =>
    widths.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * Math.max(count - 1, 0);

  if (span(widths.length) <= available) return widths.length;
  for (let count = widths.length - 1; count > 1; count -= 1) {
    if (span(count) + gap + moreWidth <= available) return count;
  }
  return 1;
};
