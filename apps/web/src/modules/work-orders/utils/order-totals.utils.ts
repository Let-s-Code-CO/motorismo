/**
 * What an order adds up to (spec 008): subtotal = sum of the lines (CA-04); total = subtotal minus
 * the order's fixed discount (CA-25, RN-02). Blank values count as nothing until typed, and the
 * total never shows below zero (an invalid discount is reported by the form).
 */
export const orderTotals = (
  lines: readonly { price: number | null | undefined }[],
  discount: number | null | undefined
) => {
  const subtotal = lines.reduce((sum, line) => sum + (line.price ?? 0), 0);
  const off = discount ?? 0;
  return { subtotal, discount: off, total: Math.max(subtotal - off, 0) };
};
